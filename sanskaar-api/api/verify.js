/* POST /api/verify  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
   -> { ok: true, orderId, paymentId }  — confirms the payment really came from Razorpay */
const { verifySignature } = require("../lib/orders");
const { preflight, readJson, send } = require("../lib/http");

module.exports = async function verify(req, res) {
  if (preflight(req, res)) return;
  try {
    const body = await readJson(req);
    if (!verifySignature(body, process.env.RAZORPAY_KEY_SECRET)) return send(res, 400, { ok: false, error: "Payment could not be verified." });
    send(res, 200, { ok: true, orderId: body.razorpay_order_id, paymentId: body.razorpay_payment_id });
  } catch (err) {
    console.error(err);
    send(res, 400, { ok: false, error: "Payment could not be verified." });
  }
};
