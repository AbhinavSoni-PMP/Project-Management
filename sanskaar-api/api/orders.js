/* POST /api/orders  { items: [{ id, size, qty }], customer: {...} }
   -> { orderId, keyId, amount, currency, receipt, summary } */
const { createRazorpayOrder, OrderError } = require("../lib/orders");
const { preflight, readJson, send } = require("../lib/http");

module.exports = async function orders(req, res) {
  if (preflight(req, res)) return;
  try {
    const body = await readJson(req);
    send(res, 200, await createRazorpayOrder(body));
  } catch (err) {
    if (err instanceof OrderError) return send(res, 400, { error: err.message });
    console.error(err);
    send(res, 502, { error: "We couldn't start the payment. Please try again in a moment." });
  }
};
