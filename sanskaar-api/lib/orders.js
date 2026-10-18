/* ==========================================================================
   Orders: pricing from the live catalogue, Razorpay orders, payment
   verification and delivery tracking.
   ========================================================================== */
const crypto = require("crypto");
const catalog = require("../data/catalog.json");
const { db } = require("./db");
const { HttpError } = require("./http");
const { productsById } = require("./catalog");

const MAX_QTY = 10;
const MAX_LINES = 30;
const RAZORPAY_API = "https://api.razorpay.com/v1";
/** Delivery journey, in order. "cancelled" can be set at any point. */
const STATUSES = ["confirmed", "tailoring", "shipped", "out_for_delivery", "delivered", "cancelled"];

const inr = n => "₹" + Number(n).toLocaleString("en-IN");

/** Prices the bag from the live catalogue (never from the client) and checks stock. */
async function priceOrder(items) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, "Your bag is empty.");
  if (items.length > MAX_LINES) throw new HttpError(400, "Too many items in one order.");
  const live = await productsById(items.map(it => String(it && it.id)));
  const wanted = new Map();
  const lines = items.map(it => {
    const p = live.get(String(it && it.id));
    if (!p || !p.active) throw new HttpError(400, "An item in your bag is no longer available.");
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new HttpError(400, `Please choose 1–${MAX_QTY} of ${p.name}.`);
    if (it.size !== "Custom" && !p.sizes.includes(it.size)) throw new HttpError(400, `Please choose a size for ${p.name}.`);
    wanted.set(p.id, (wanted.get(p.id) || 0) + qty);
    if (wanted.get(p.id) > p.remaining) {
      throw new HttpError(409, p.remaining ? `Only ${p.remaining} of ${p.name} left. Please reduce the quantity.` : `${p.name} is sold out.`);
    }
    return { id: p.id, name: p.name, size: it.size, qty, price: p.price, total: p.price * qty, deliveryDays: p.deliveryDays };
  });
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const shipping = subtotal >= catalog.config.freeShippingAbove ? 0 : catalog.config.shippingFee;
  return { lines, subtotal, shipping, total: subtotal + shipping, deliveryDays: Math.max(...lines.map(l => l.deliveryDays)) };
}

const clean = v => String(v == null ? "" : v).trim().replace(/\s+/g, " ").slice(0, 200);

function validateCustomer(c) {
  c = c || {};
  const out = {
    name: clean(c.name), phone: clean(c.phone).replace(/[\s-]/g, "").replace(/^(\+91|0)/, ""), email: clean(c.email).toLowerCase(),
    line1: clean(c.line1), line2: clean(c.line2), city: clean(c.city), state: clean(c.state), pincode: clean(c.pincode)
  };
  if (!out.name) throw new HttpError(400, "Please enter your full name.");
  if (!/^[6-9]\d{9}$/.test(out.phone)) throw new HttpError(400, "Please enter a valid 10-digit mobile number.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw new HttpError(400, "Please enter a valid email address.");
  if (!out.line1 || !out.city || !out.state) throw new HttpError(400, "Please complete your delivery address.");
  if (!/^\d{6}$/.test(out.pincode)) throw new HttpError(400, "Please enter a valid 6-digit PIN code.");
  return out;
}

/** Razorpay order notes (max 15 keys × 256 chars) so the order shows up complete in the dashboard too. */
function orderNotes(customer, priced) {
  const notes = {
    customer: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: [customer.line1, customer.line2].filter(Boolean).join(", ").slice(0, 256),
    city: `${customer.city}, ${customer.state} ${customer.pincode}`.slice(0, 256)
  };
  priced.lines.slice(0, 10).forEach((l, i) => {
    notes[`item_${i + 1}`] = `${l.id} · ${l.name} · Size ${l.size} × ${l.qty} · ${inr(l.total)}`.slice(0, 256);
  });
  return notes;
}

async function createOrder(user, { items, customer }, env = process.env, fetchImpl = fetch) {
  const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret } = env;
  if (!keyId || !keySecret) throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set");
  const priced = await priceOrder(items);
  const cust = validateCustomer(customer);
  const receipt = `SK-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  const res = await fetchImpl(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64") },
    body: JSON.stringify({ amount: priced.total * 100, currency: "INR", receipt, notes: orderNotes(cust, priced) })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay order failed (${res.status}): ${body.error && body.error.description}`);

  const { query } = await db();
  const [order] = await query(
    `insert into orders (receipt, user_id, customer, subtotal, shipping, total, razorpay_order_id)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [receipt, user.id, JSON.stringify(cust), priced.subtotal, priced.shipping, priced.total, body.id]
  );
  for (const l of priced.lines) {
    await query("insert into order_items (order_id, product_id, name, size, qty, price) values ($1, $2, $3, $4, $5, $6)",
      [order.id, l.id, l.name, l.size, l.qty, l.price]);
  }
  return { orderId: body.id, keyId, amount: body.amount, currency: body.currency, receipt, summary: priced };
}

function verifySignature({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature }, secret) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Marks the order paid and starts its delivery timeline. Safe to call twice. */
async function confirmPayment(user, body, secret = process.env.RAZORPAY_KEY_SECRET) {
  if (!verifySignature(body, secret)) throw new HttpError(400, "Payment could not be verified.");
  const { query } = await db();
  const [order] = await query("select * from orders where razorpay_order_id = $1 and user_id = $2", [body.razorpay_order_id, user.id]);
  if (!order) throw new HttpError(404, "Order not found.");
  if (order.status === "pending") {
    const [{ days }] = await query(
      `select coalesce(max(p.delivery_days), 10)::int as days from order_items i join products p on p.id = i.product_id where i.order_id = $1`,
      [order.id]
    );
    await query(
      `update orders set status = 'confirmed', payment_id = $2, paid_at = now(),
         expected_delivery = current_date + $3::int,
         history = history || $4::jsonb where id = $1`,
      [order.id, body.razorpay_payment_id, days, JSON.stringify([{ status: "confirmed", at: new Date().toISOString() }])]
    );
  }
  return getOrder(user, order.receipt);
}

const day = d => (!d ? null : typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

async function shapeOrders(rows) {
  if (!rows.length) return [];
  const { query } = await db();
  const items = await query("select * from order_items where order_id = any($1)", [rows.map(r => r.id)]);
  return rows.map(r => ({
    receipt: r.receipt,
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    paymentId: r.payment_id,
    subtotal: r.subtotal, shipping: r.shipping, total: r.total,
    customer: r.customer,
    items: items.filter(i => i.order_id === r.id).map(i => ({ id: i.product_id, name: i.name, size: i.size, qty: i.qty, price: i.price })),
    expectedDelivery: day(r.expected_delivery),
    courier: r.courier, trackingNo: r.tracking_no, trackingUrl: r.tracking_url,
    history: r.history
  }));
}

async function myOrders(user) {
  const { query } = await db();
  return shapeOrders(await query("select * from orders where user_id = $1 and status <> 'pending' order by created_at desc", [user.id]));
}

async function getOrder(user, receipt) {
  const { query } = await db();
  const rows = user.isOwner
    ? await query("select * from orders where receipt = $1", [receipt])
    : await query("select * from orders where receipt = $1 and user_id = $2", [receipt, user.id]);
  if (!rows.length) throw new HttpError(404, "Order not found.");
  return (await shapeOrders(rows))[0];
}

async function allOrders({ status } = {}) {
  const { query } = await db();
  const rows = status
    ? await query("select * from orders where status = $1 order by created_at desc limit 500", [status])
    : await query("select * from orders where status <> 'pending' order by created_at desc limit 500");
  return shapeOrders(rows);
}

/** Owner updates the delivery status, dates and courier details. */
async function updateOrder(receipt, input) {
  const { query } = await db();
  const [order] = await query("select * from orders where receipt = $1", [receipt]);
  if (!order) throw new HttpError(404, "Order not found.");
  if (order.status === "pending") throw new HttpError(400, "This order hasn't been paid yet.");
  const status = input.status == null ? order.status : String(input.status);
  if (!STATUSES.includes(status)) throw new HttpError(400, `Status must be one of ${STATUSES.join(", ")}.`);
  const expected = input.expectedDelivery == null ? day(order.expected_delivery) : String(input.expectedDelivery);
  if (expected && !/^\d{4}-\d{2}-\d{2}$/.test(expected)) throw new HttpError(400, "Expected delivery must be a date like 2026-11-20.");
  const note = String(input.note || "").trim().slice(0, 300);
  const history = status !== order.status || note ? [{ status, at: new Date().toISOString(), ...(note ? { note } : {}) }] : [];
  const txt = (v, cur) => (v == null ? cur : String(v).trim().slice(0, 300));
  const url = txt(input.trackingUrl, order.tracking_url);
  if (url && !/^https?:\/\//i.test(url)) throw new HttpError(400, "Tracking link must start with http:// or https://");
  await query(
    `update orders set status = $2, expected_delivery = $3, courier = $4, tracking_no = $5, tracking_url = $6,
       history = history || $7::jsonb where id = $1`,
    [order.id, status, expected, txt(input.courier, order.courier), txt(input.trackingNo, order.tracking_no), url, JSON.stringify(history)]
  );
  return getOrder({ isOwner: true }, receipt);
}

module.exports = {
  STATUSES, priceOrder, validateCustomer, orderNotes, createOrder, verifySignature, confirmPayment,
  myOrders, getOrder, allOrders, updateOrder
};
