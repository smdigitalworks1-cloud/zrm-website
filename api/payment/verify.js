/*
  POST /api/payment/verify
  { razorpay_order_id, razorpay_payment_id, razorpay_signature }

  The ONLY place a payment becomes "paid":
    1. checkout signature checked with the key secret (HMAC)
    2. payment fetched from Razorpay: must belong to this order, be ₹499 INR,
       and be captured (an authorized payment is captured here)
  Then a signed session cookie is set and the browser may open /form.
*/
const { send, fail, onlyPost, body } = require("../_lib/http");
const { setSession } = require("../_lib/session");
const razorpay = require("../_lib/razorpay");

module.exports = async function handler(req, res) {
  if (!onlyPost(req, res)) return;

  const b = body(req);
  const orderId = String(b.razorpay_order_id || "");
  const paymentId = String(b.razorpay_payment_id || "");
  const signature = String(b.razorpay_signature || "");

  try {
    if (!razorpay.signatureValid(orderId, paymentId, signature)) {
      fail(res, 400, "We couldn't verify this payment. If money was deducted, please contact support.", "bad_signature");
      return;
    }

    let payment = await razorpay.fetchPayment(paymentId);
    if (payment.order_id !== orderId ||
        payment.amount !== razorpay.PRODUCT.amount ||
        payment.currency !== razorpay.PRODUCT.currency) {
      fail(res, 400, "We couldn't verify this payment. If money was deducted, please contact support.", "mismatch");
      return;
    }

    if (payment.status === "authorized") {
      payment = await razorpay.capturePayment(paymentId);
    }
    if (payment.status !== "captured") {
      fail(res, 402, "Your payment was not completed. Please try again.", "not_captured");
      return;
    }

    const paidAt = new Date((payment.created_at || Date.now() / 1000) * 1000).toISOString();
    setSession(req, res, {
      status: "paid",
      paymentId,
      orderId,
      amount: payment.amount,
      paidAt,
      product: razorpay.PRODUCT.name + " – " + razorpay.PRODUCT.description,
      registered: false
    });

    send(res, 200, { ok: true, next: "/form" });
  } catch (err) {
    console.error("verify:", err.message);
    fail(res, 502, "We couldn't confirm your payment yet. Please tap “Verify again”. If money was deducted, it is safe – contact support.", "verify_failed");
  }
};
