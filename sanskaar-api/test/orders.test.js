const { test } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { priceOrder, validateCustomer, createRazorpayOrder, verifySignature, OrderError } = require("../lib/orders");
const catalog = require("../data/catalog.json");

const lehenga = catalog.products.find(p => p.id === "SK-W-LHG-001");
const customer = {
  name: "Asha Rao", phone: "+91 98765 43210", email: "asha@example.com",
  line1: "12 MI Road", line2: "", city: "Jaipur", state: "Rajasthan", pincode: "302001"
};
const env = { RAZORPAY_KEY_ID: "rzp_test_abc", RAZORPAY_KEY_SECRET: "secret123" };

test("prices come from the catalogue, not the client", () => {
  const out = priceOrder([{ id: lehenga.id, size: "M", qty: 2, price: 1 }]);
  assert.strictEqual(out.subtotal, lehenga.price * 2);
  assert.strictEqual(out.lines[0].price, lehenga.price);
});

test("free shipping above the threshold, fee below it", () => {
  assert.strictEqual(priceOrder([{ id: lehenga.id, size: "M", qty: 1 }]).shipping, 0);
  const cheap = { config: { freeShippingAbove: 4999, shippingFee: 250 }, products: [{ id: "X", name: "X", price: 1000, sizes: ["M"] }] };
  const out = priceOrder([{ id: "X", size: "M", qty: 1 }], cheap);
  assert.deepStrictEqual([out.shipping, out.total], [250, 1250]);
});

test("rejects unknown items, bad sizes and bad quantities", () => {
  assert.throws(() => priceOrder([]), OrderError);
  assert.throws(() => priceOrder([{ id: "NOPE", size: "M", qty: 1 }]), OrderError);
  assert.throws(() => priceOrder([{ id: lehenga.id, size: "44", qty: 1 }]), OrderError);
  assert.throws(() => priceOrder([{ id: lehenga.id, size: "M", qty: 0 }]), OrderError);
  assert.throws(() => priceOrder([{ id: lehenga.id, size: "M", qty: 1.5 }]), OrderError);
  assert.doesNotThrow(() => priceOrder([{ id: lehenga.id, size: "Custom", qty: 1 }]));
});

test("validates the delivery details", () => {
  assert.strictEqual(validateCustomer(customer).phone, "9876543210");
  assert.throws(() => validateCustomer({ ...customer, phone: "12345" }), OrderError);
  assert.throws(() => validateCustomer({ ...customer, email: "nope" }), OrderError);
  assert.throws(() => validateCustomer({ ...customer, pincode: "30200" }), OrderError);
  assert.throws(() => validateCustomer({ ...customer, line1: " " }), OrderError);
});

test("creates the Razorpay order for the server-computed amount, in paise", async () => {
  let call;
  const fakeFetch = async (url, init) => {
    call = { url, init, body: JSON.parse(init.body) };
    return { ok: true, status: 200, json: async () => ({ id: "order_123", amount: call.body.amount, currency: "INR" }) };
  };
  const out = await createRazorpayOrder({ items: [{ id: lehenga.id, size: "M", qty: 1, price: 1 }], customer }, env, fakeFetch);
  assert.strictEqual(call.url, "https://api.razorpay.com/v1/orders");
  assert.strictEqual(call.body.amount, lehenga.price * 100);
  assert.strictEqual(call.body.currency, "INR");
  assert.strictEqual(call.init.headers.Authorization, "Basic " + Buffer.from("rzp_test_abc:secret123").toString("base64"));
  assert.match(call.body.notes.item_1, /SK-W-LHG-001/);
  assert.strictEqual(call.body.notes.phone, "9876543210");
  assert.deepStrictEqual([out.orderId, out.keyId, out.amount], ["order_123", "rzp_test_abc", lehenga.price * 100]);
});

test("surfaces Razorpay failures and missing keys as server errors", async () => {
  const failing = async () => ({ ok: false, status: 401, json: async () => ({ error: { description: "Authentication failed" } }) });
  await assert.rejects(createRazorpayOrder({ items: [{ id: lehenga.id, size: "M", qty: 1 }], customer }, env, failing), /401/);
  await assert.rejects(createRazorpayOrder({ items: [{ id: lehenga.id, size: "M", qty: 1 }], customer }, {}, failing), /not set/);
});

test("verifies Razorpay payment signatures", () => {
  const sig = crypto.createHmac("sha256", "secret123").update("order_123|pay_456").digest("hex");
  const ok = { razorpay_order_id: "order_123", razorpay_payment_id: "pay_456", razorpay_signature: sig };
  assert.ok(verifySignature(ok, "secret123"));
  assert.ok(!verifySignature({ ...ok, razorpay_payment_id: "pay_999" }, "secret123"));
  assert.ok(!verifySignature({ ...ok, razorpay_signature: "short" }, "secret123"));
  assert.ok(!verifySignature(ok, "other-secret"));
  assert.ok(!verifySignature({}, "secret123"));
});
