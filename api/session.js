/*
  GET /api/session
  Safe view of the flow state for the pages (no secrets, nothing that would
  let the browser fake a payment – the cookie itself is HttpOnly + signed).
*/
const { send } = require("./_lib/http");
const { getSession } = require("./_lib/session");

module.exports = function handler(req, res) {
  const s = getSession(req);
  if (!s || s.status !== "paid") {
    send(res, 200, { paid: false, registered: false });
    return;
  }
  send(res, 200, {
    paid: true,
    registered: !!s.registered,
    paymentId: s.paymentId,
    orderId: s.orderId,
    amount: s.amount,
    paidAt: s.paidAt,
    product: s.product
  });
};
