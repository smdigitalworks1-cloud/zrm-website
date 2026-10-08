/*
  POST /api/payment/order
  Creates a Razorpay order for the ZRM seat (₹499) and returns what the
  checkout needs. Amount is fixed server-side – the browser cannot change it.
  If this browser already has a verified payment, no new order is created.
*/
const { send, fail, onlyPost } = require("../_lib/http");
const { getSession } = require("../_lib/session");
const razorpay = require("../_lib/razorpay");

module.exports = async function handler(req, res) {
  if (!onlyPost(req, res)) return;

  const session = getSession(req);
  if (session && session.status === "paid") {
    send(res, 200, { ok: true, alreadyPaid: true, next: session.registered ? "/thank-you" : "/form" });
    return;
  }

  try {
    const order = await razorpay.createOrder();
    send(res, 200, {
      ok: true,
      keyId: razorpay.keys().id,          // public key only
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      name: razorpay.PRODUCT.name,
      description: razorpay.PRODUCT.description
    });
  } catch (err) {
    console.error("order:", err.message);
    fail(res, 502, "We couldn't start the payment right now. Please try again in a moment.", "order_failed");
  }
};
