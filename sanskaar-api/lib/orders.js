/* ==========================================================================
   SANSKAAR payments — pricing, Razorpay orders and signature checks
   --------------------------------------------------------------------------
   Prices always come from data/catalog.json (synced from the website), never
   from the phone, so an order can't be tampered with.
   ========================================================================== */
const crypto = require("crypto");
const catalog = require("../data/catalog.json");

const MAX_QTY = 10;
const MAX_LINES = 30;
const RAZORPAY_API = "https://api.razorpay.com/v1";

/** An error whose message is safe to show the customer. */
class OrderError extends Error {}

const inr = n => "₹" + Number(n).toLocaleString("en-IN");

function priceOrder(items, cat = catalog) {
  if (!Array.isArray(items) || !items.length) throw new OrderError("Your bag is empty.");
  if (items.length > MAX_LINES) throw new OrderError("Too many items in one order.");
  const lines = items.map(it => {
    const p = cat.products.find(x => x.id === (it && it.id));
    if (!p) throw new OrderError("An item in your bag is no longer available.");
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new OrderError(`Please choose 1–${MAX_QTY} of ${p.name}.`);
    if (it.size !== "Custom" && !p.sizes.includes(it.size)) throw new OrderError(`Please choose a size for ${p.name}.`);
    return { id: p.id, name: p.name, size: it.size, qty, price: p.price, total: p.price * qty };
  });
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const shipping = subtotal >= cat.config.freeShippingAbove ? 0 : cat.config.shippingFee;
  return { lines, subtotal, shipping, total: subtotal + shipping };
}

const clean = v => String(v == null ? "" : v).trim().replace(/\s+/g, " ").slice(0, 200);

function validateCustomer(c) {
  c = c || {};
  const out = {
    name: clean(c.name), phone: clean(c.phone).replace(/[\s-]/g, "").replace(/^(\+91|0)/, ""), email: clean(c.email).toLowerCase(),
    line1: clean(c.line1), line2: clean(c.line2), city: clean(c.city), state: clean(c.state), pincode: clean(c.pincode)
  };
  if (!out.name) throw new OrderError("Please enter your full name.");
  if (!/^[6-9]\d{9}$/.test(out.phone)) throw new OrderError("Please enter a valid 10-digit mobile number.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw new OrderError("Please enter a valid email address.");
  if (!out.line1 || !out.city || !out.state) throw new OrderError("Please complete your delivery address.");
  if (!/^\d{6}$/.test(out.pincode)) throw new OrderError("Please enter a valid 6-digit PIN code.");
  return out;
}

/** Razorpay order notes (max 15 keys × 256 chars) so the order shows up complete in the dashboard. */
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

async function createRazorpayOrder({ items, customer }, env = process.env, fetchImpl = fetch) {
  const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret } = env;
  if (!keyId || !keySecret) throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set");
  const priced = priceOrder(items);
  const cust = validateCustomer(customer);
  const receipt = `SK-${Date.now().toString(36).toUpperCase()}`;
  const res = await fetchImpl(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64") },
    body: JSON.stringify({ amount: priced.total * 100, currency: "INR", receipt, notes: orderNotes(cust, priced) })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay order failed (${res.status}): ${body.error && body.error.description}`);
  return { orderId: body.id, keyId, amount: body.amount, currency: body.currency, receipt, summary: priced };
}

function verifySignature({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature }, secret) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { OrderError, priceOrder, validateCustomer, orderNotes, createRazorpayOrder, verifySignature };
