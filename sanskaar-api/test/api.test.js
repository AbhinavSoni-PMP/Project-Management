/* End-to-end tests of the API over HTTP, on an in-memory Postgres (PGlite).
   Only Razorpay is simulated. */
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const http = require("http");
const ExcelJS = require("exceljs");

process.env.AUTH_SECRET = "test-auth-secret-0123456789";
process.env.OWNER_EMAILS = "owner@sanskaar.in";
process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
process.env.RAZORPAY_KEY_SECRET = "secret123";
delete process.env.DATABASE_URL;
delete process.env.PGLITE_DIR;

const api = require("../api/index");
const { sellingPrice } = require("../lib/catalog");

let base, server;
const razorpayCalls = [];
const realFetch = global.fetch;
global.fetch = async (url, init) => {
  if (String(url).startsWith("https://api.razorpay.com/")) {
    const body = JSON.parse(init.body);
    razorpayCalls.push(body);
    return { ok: true, status: 200, json: async () => ({ id: `order_${razorpayCalls.length}`, amount: body.amount, currency: "INR" }) };
  }
  return realFetch(url, init);
};

before(async () => {
  server = http.createServer(api);
  await new Promise(r => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

async function call(method, path, { token, body, raw } = {}) {
  const res = await realFetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (raw) return res;
  return { status: res.status, body: await res.json() };
}
const sign = (orderId, paymentId) => crypto.createHmac("sha256", "secret123").update(`${orderId}|${paymentId}`).digest("hex");
const address = { name: "Asha Rao", phone: "9876543210", email: "asha@example.com", line1: "12 MI Road", line2: "", city: "Jaipur", state: "Rajasthan", pincode: "302001" };

let asha, ravi, owner;

test("selling price applies % then ₹ discount", () => {
  assert.strictEqual(sellingPrice(10000, 10, 500), 8500);
  assert.strictEqual(sellingPrice(1000, 0, 2000), 0);
});

test("catalogue is seeded from the website with the same prices", async () => {
  const { status, body } = await call("GET", "/api/catalog");
  assert.strictEqual(status, 200);
  assert.strictEqual(body.products.length, 57);
  const p = body.products.find(x => x.id === "SK-M-IWS-101");
  assert.deepStrictEqual([p.price, p.mrp, p.inStock, p.sizeUnit], [24999, 28999, true, "Inches"]);
  assert.strictEqual(p.inventory, undefined, "stock counts are not public");
});

test("sign up, log in with email or mobile, and reject bad input", async () => {
  let r = await call("POST", "/api/auth/signup", { body: { name: "Asha Rao", email: "Asha@Example.com", phone: "+91 98765 43210", password: "rangoli123" } });
  assert.strictEqual(r.status, 200);
  asha = r.body.token;
  assert.deepStrictEqual([r.body.user.email, r.body.user.phone, r.body.user.isOwner], ["asha@example.com", "9876543210", false]);

  assert.strictEqual((await call("POST", "/api/auth/signup", { body: { name: "A", email: "asha@example.com", phone: "9123456780", password: "rangoli123" } })).status, 409);
  assert.strictEqual((await call("POST", "/api/auth/signup", { body: { name: "B", email: "b@example.com", phone: "12345", password: "rangoli123" } })).status, 400);
  assert.strictEqual((await call("POST", "/api/auth/signup", { body: { name: "B", email: "b@example.com", phone: "9123456780", password: "short" } })).status, 400);

  assert.strictEqual((await call("POST", "/api/auth/login", { body: { login: "9876543210", password: "rangoli123" } })).status, 200);
  assert.strictEqual((await call("POST", "/api/auth/login", { body: { login: "ASHA@example.com", password: "rangoli123" } })).status, 200);
  assert.strictEqual((await call("POST", "/api/auth/login", { body: { login: "asha@example.com", password: "wrong-pass" } })).status, 401);

  r = await call("GET", "/api/auth/me", { token: asha });
  assert.strictEqual(r.body.user.name, "Asha Rao");
  assert.strictEqual((await call("GET", "/api/auth/me", { token: asha + "x" })).status, 401);

  ravi = (await call("POST", "/api/auth/signup", { body: { name: "Ravi", email: "ravi@example.com", phone: "9000000001", password: "sherwani99" } })).body.token;
  r = await call("POST", "/api/auth/signup", { body: { name: "Owner", email: "owner@sanskaar.in", phone: "9000000002", password: "owner-pass-1" } });
  owner = r.body.token;
  assert.strictEqual(r.body.user.isOwner, true);
});

test("ordering needs an account", async () => {
  assert.strictEqual((await call("POST", "/api/orders", { body: { items: [], customer: address } })).status, 401);
});

let receipt;
test("order → payment → confirmed with a delivery date; sold and remaining update", async () => {
  const r = await call("POST", "/api/orders", { token: asha, body: { items: [{ id: "SK-W-LHG-001", size: "M", qty: 2, price: 1 }], customer: address } });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(razorpayCalls.at(-1).amount, 184999 * 2 * 100, "priced from the database, not the client");
  receipt = r.body.receipt;

  // not visible as an order until paid
  assert.strictEqual((await call("GET", "/api/orders", { token: asha })).body.orders.length, 0);

  const bad = await call("POST", "/api/verify", { token: asha, body: { razorpay_order_id: r.body.orderId, razorpay_payment_id: "pay_1", razorpay_signature: "nope" } });
  assert.strictEqual(bad.status, 400);

  const ok = await call("POST", "/api/verify", { token: asha, body: { razorpay_order_id: r.body.orderId, razorpay_payment_id: "pay_1", razorpay_signature: sign(r.body.orderId, "pay_1") } });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.order.status, "confirmed");
  const expected = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  assert.strictEqual(ok.body.order.expectedDelivery, expected);

  // paying twice is harmless
  const again = await call("POST", "/api/verify", { token: asha, body: { razorpay_order_id: r.body.orderId, razorpay_payment_id: "pay_1", razorpay_signature: sign(r.body.orderId, "pay_1") } });
  assert.strictEqual(again.body.order.history.length, 1);

  const mine = (await call("GET", "/api/orders", { token: asha })).body.orders;
  assert.deepStrictEqual(mine.map(o => [o.receipt, o.items[0].qty, o.total]), [[receipt, 2, 369998]]);
  assert.strictEqual((await call("GET", `/api/orders/${receipt}`, { token: ravi })).status, 404, "other customers can't see it");

  const admin = (await call("GET", "/api/admin/products", { token: owner })).body.products.find(p => p.id === "SK-W-LHG-001");
  assert.deepStrictEqual([admin.inventory, admin.sold, admin.remaining], [10, 2, 8]);
});

test("stock limits are enforced", async () => {
  assert.strictEqual((await call("PUT", "/api/admin/products/SK-W-LHG-001", { token: owner, body: { inventory: 3 } })).status, 200);
  const r = await call("POST", "/api/orders", { token: ravi, body: { items: [{ id: "SK-W-LHG-001", size: "S", qty: 2 }], customer: { ...address, phone: "9000000001" } } });
  assert.strictEqual(r.status, 409);
  assert.match(r.body.error, /Only 1/);
  const cat = (await call("GET", "/api/catalog")).body.products.find(p => p.id === "SK-W-LHG-001");
  assert.strictEqual(cat.lowStock, 1);
});

test("only the owner can use admin; price and discount updates go live", async () => {
  assert.strictEqual((await call("GET", "/api/admin/products", { token: asha })).status, 403);
  assert.strictEqual((await call("GET", "/api/admin/products")).status, 401);
  let r = await call("PUT", "/api/admin/products/SK-M-KUR-001", { token: owner, body: { mrp: 9000, discountPct: 10, discountAmt: 100, deliveryDays: 5, sizes: "S, M, L", sizeUnit: "uk" } });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.deepStrictEqual([r.body.product.price, r.body.product.sizeUnit], [8000, "UK"]);
  const cat = (await call("GET", "/api/catalog")).body.products.find(p => p.id === "SK-M-KUR-001");
  assert.deepStrictEqual([cat.price, cat.mrp, cat.deliveryDays, cat.sizes], [8000, 9000, 5, ["S", "M", "L"]]);
  assert.strictEqual((await call("PUT", "/api/admin/products/SK-M-KUR-001", { token: owner, body: { sizeUnit: "EU" } })).status, 400);
  assert.strictEqual((await call("PUT", "/api/admin/products/SK-M-KUR-001", { token: owner, body: { discountAmt: 99999 } })).status, 400);
  r = await call("PUT", "/api/admin/products/SK-M-KUR-002", { token: owner, body: { active: false } });
  assert.strictEqual((await call("GET", "/api/catalog")).body.products.find(p => p.id === "SK-M-KUR-002").inStock, false);
});

test("owner updates delivery status and the customer sees the timeline", async () => {
  assert.strictEqual((await call("PUT", `/api/admin/orders/${receipt}`, { token: asha, body: { status: "shipped" } })).status, 403);
  assert.strictEqual((await call("PUT", `/api/admin/orders/${receipt}`, { token: owner, body: { status: "lost" } })).status, 400);
  const r = await call("PUT", `/api/admin/orders/${receipt}`, { token: owner, body: {
    status: "shipped", courier: "Blue Dart", trackingNo: "BD123", trackingUrl: "https://bluedart.com/track/BD123", expectedDelivery: "2026-11-02", note: "Packed with care"
  } });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const o = (await call("GET", `/api/orders/${receipt}`, { token: asha })).body.order;
  assert.deepStrictEqual([o.status, o.courier, o.trackingNo, o.expectedDelivery], ["shipped", "Blue Dart", "BD123", "2026-11-02"]);
  assert.deepStrictEqual(o.history.map(h => h.status), ["confirmed", "shipped"]);
  assert.strictEqual(o.history[1].note, "Packed with care");
  const list = (await call("GET", "/api/admin/orders", { token: owner })).body;
  assert.strictEqual(list.orders[0].receipt, receipt);
  assert.ok(list.statuses.includes("out_for_delivery"));
});

test("Excel: download, edit the yellow columns, upload", async () => {
  const res = await call("GET", "/api/admin/catalog.xlsx", { token: owner, raw: true });
  assert.strictEqual(res.status, 200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
  const ws = wb.getWorksheet("Products");
  const headers = ws.getRow(1).values.slice(1);
  assert.deepStrictEqual(headers.slice(0, 4), ["Product ID", "Name", "Category", "MRP (₹)"]);
  const rowOf = id => { let found; ws.eachRow(r => { if (r.getCell(1).value === id) found = r; }); return found; };
  const lhg = rowOf("SK-W-LHG-001");
  assert.strictEqual(lhg.getCell(13).value, 2, "sold counted from orders");
  assert.match(lhg.getCell(14).value.formula, /MAX\(0,L\d+-M\d+\)/, "remaining is an Excel formula");
  assert.match(lhg.getCell(7).value.formula, /ROUND/, "selling price is an Excel formula");
  assert.ok(wb.getWorksheet("Orders").getRow(2).getCell(1).value === receipt);

  const row = rowOf("SK-W-SAR-001");
  row.getCell(5).value = 20;       // Discount %
  row.getCell(6).value = 0;        // Discount ₹
  row.getCell(12).value = 25;      // Stock received
  row.getCell(13).value = 999;     // Sold (grey) — must be ignored
  let file = Buffer.from(await wb.xlsx.writeBuffer()).toString("base64");
  let up = await call("POST", "/api/admin/catalog.xlsx", { token: owner, body: { file } });
  assert.strictEqual(up.status, 200, JSON.stringify(up.body));
  const sar = (await call("GET", "/api/admin/products", { token: owner })).body.products.find(p => p.id === "SK-W-SAR-001");
  assert.deepStrictEqual([sar.discountPct, sar.price, sar.inventory, sar.sold], [20, Math.round(44999 * 0.8), 25, 0]);

  // one bad row → nothing saved, problems listed
  row.getCell(12).value = 99;
  rowOf("SK-W-SAR-002").getCell(11).value = "EU";
  file = Buffer.from(await wb.xlsx.writeBuffer()).toString("base64");
  up = await call("POST", "/api/admin/catalog.xlsx", { token: owner, body: { file } });
  assert.strictEqual(up.status, 400);
  assert.match(up.body.details[0], /SK-W-SAR-002: size unit/);
  const still = (await call("GET", "/api/admin/products", { token: owner })).body.products.find(p => p.id === "SK-W-SAR-001");
  assert.strictEqual(still.inventory, 25);

  assert.strictEqual((await call("POST", "/api/admin/catalog.xlsx", { token: owner, body: { file: Buffer.from("not excel").toString("base64") } })).status, 400);
});
