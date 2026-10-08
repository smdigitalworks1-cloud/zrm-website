/*
  Razorpay server-side calls. The key secret only ever lives here
  (RAZORPAY_KEY_SECRET env var) – the browser gets the public key id only.
*/
const crypto = require("crypto");

// the one product sold by this site
const PRODUCT = {
  name: "Zero Rupee Marketing Challenge",
  description: "3 DAYS LIVE ON ZOOM",
  amount: 49900, // paise → ₹499
  currency: "INR"
};

function keys() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay keys missing");
  return { id, secret };
}

async function api(method, path, payload) {
  const { id, secret } = keys();
  const res = await fetch("https://api.razorpay.com/v1" + path, {
    method,
    headers: {
      Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"),
      "Content-Type": "application/json"
    },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error("Razorpay " + path + " → " + res.status);
  return data;
}

function createOrder() {
  return api("POST", "/orders", {
    amount: PRODUCT.amount,
    currency: PRODUCT.currency,
    receipt: "zrm_" + Date.now(),
    notes: { product: PRODUCT.name + " – " + PRODUCT.description }
  });
}

// checkout signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
function signatureValid(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac("sha256", keys().secret)
    .update(orderId + "|" + paymentId).digest("hex");
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function fetchPayment(paymentId) {
  return api("GET", "/payments/" + encodeURIComponent(paymentId));
}

function capturePayment(paymentId) {
  return api("POST", "/payments/" + encodeURIComponent(paymentId) + "/capture",
    { amount: PRODUCT.amount, currency: PRODUCT.currency });
}

module.exports = { PRODUCT, keys, createOrder, signatureValid, fetchPayment, capturePayment };
