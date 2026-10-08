/*
  End-to-end test of HOME → PAYMENT → VERIFY → FORM → THANK YOU against the
  local dev server, with Razorpay and GoHighLevel replaced by in-memory mocks
  (no real money, no CRM writes).

  Usage:  node scripts/test-flow.js
*/
const http = require("http");
const crypto = require("crypto");
const { createServer } = require("./dev-server");

// ---------- test env (fake credentials) ----------
process.env.RAZORPAY_KEY_ID = "rzp_test_mock";
process.env.RAZORPAY_KEY_SECRET = "mock_secret_for_tests";
process.env.SESSION_SECRET = "x".repeat(40);
process.env.GHL_PIT_TOKEN = "pit-mock";
process.env.GHL_LOCATION_ID = "loc-mock";

// ---------- mocks ----------
const db = { orders: {}, payments: {}, contacts: {}, notes: {}, upserts: 0 };
let paymentOverride = null;

function reply(status, body) {
  return Promise.resolve({ ok: status < 400, status, json: function () { return Promise.resolve(body); } });
}

global.fetch = function (url, opts) {
  opts = opts || {};
  const body = opts.body ? JSON.parse(opts.body) : null;
  if (url.indexOf("https://api.razorpay.com/v1") === 0) {
    const p = url.slice("https://api.razorpay.com/v1".length);
    if (p === "/orders") {
      const id = "order_" + (Object.keys(db.orders).length + 1);
      db.orders[id] = { id, amount: body.amount, currency: body.currency };
      return reply(200, db.orders[id]);
    }
    const m = /^\/payments\/([^/]+)(\/capture)?$/.exec(p);
    if (m) {
      const pay = db.payments[m[1]];
      if (!pay) return reply(404, {});
      if (m[2]) pay.status = "captured";
      return reply(200, Object.assign({}, pay, paymentOverride || {}));
    }
  }
  if (url.indexOf("https://services.leadconnectorhq.com") === 0) {
    const p = url.slice("https://services.leadconnectorhq.com".length);
    if (p === "/contacts/upsert") {
      db.upserts++;
      const id = "c_" + body.email;
      db.contacts[id] = body;
      return reply(200, { contact: { id } });
    }
    const n = /^\/contacts\/([^/]+)\/notes$/.exec(p);
    if (n) {
      const id = decodeURIComponent(n[1]);
      db.notes[id] = db.notes[id] || [];
      if (opts.method === "POST") { db.notes[id].push({ body: body.body }); return reply(200, {}); }
      return reply(200, { notes: db.notes[id] });
    }
  }
  return reply(500, {});
};

// a successful checkout: what Razorpay would hand back to the browser
function payOrder(orderId, status) {
  const paymentId = "pay_" + crypto.randomBytes(5).toString("hex");
  db.payments[paymentId] = { id: paymentId, order_id: orderId, amount: 49900, currency: "INR",
    status: status || "captured", created_at: Math.floor(Date.now() / 1000) };
  const signature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(orderId + "|" + paymentId).digest("hex");
  return { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature };
}

// ---------- tiny HTTP client with a cookie jar ----------
function client(port) {
  let cookie = "";
  return function request(method, path, data) {
    return new Promise(function (resolve, reject) {
      const payload = data ? JSON.stringify(data) : null;
      const req = http.request({ host: "127.0.0.1", port, method, path,
        headers: Object.assign({ Cookie: cookie }, payload ? { "Content-Type": "application/json" } : {}) },
      function (res) {
        let text = "";
        res.on("data", function (c) { text += c; });
        res.on("end", function () {
          const set = res.headers["set-cookie"];
          if (set) cookie = set[0].split(";")[0];
          let json = null;
          try { json = JSON.parse(text); } catch (e) { /* html */ }
          resolve({ status: res.statusCode, location: res.headers.location, json, text });
        });
      });
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  };
}

// ---------- runner ----------
let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? "  ✔ " : "  ✘ ") + name + (cond || !extra ? "" : "  → " + extra));
  if (!cond) failures++;
}

const goodForm = { fullName: "Test User", mobile: "+91 98765 43210", email: "test@example.com", businessName: "Test Co" };

(async function () {
  const server = createServer().listen(0);
  const port = server.address().port;

  console.log("\nTEST 4/5 – direct URLs without payment");
  let c = client(port);
  let r = await c("GET", "/form");
  check("/form → redirect to /payment", r.status === 302 && r.location === "/payment", r.status + " " + r.location);
  r = await c("GET", "/thank-you");
  check("/thank-you → redirect to /payment", r.status === 302 && r.location === "/payment", r.status + " " + r.location);
  r = await c("GET", "/private/form.html");
  check("/private/* not reachable", r.status === 307 && r.location === "/payment", r.status + " " + r.location);
  r = await c("POST", "/api/register", goodForm);
  check("register without payment rejected", r.status === 401 && r.json.code === "no_payment");

  console.log("\nTEST 1 – home CTA → payment page");
  r = await c("GET", "/");
  const ctas = (r.text.match(/href="\/payment"/g) || []).length;
  check("home page CTAs point to /payment (" + ctas + ")", ctas >= 10 && r.text.indexOf('href="#"') === -1);
  r = await c("GET", "/payment");
  check("/payment serves the payment page", r.status === 200 && r.text.indexOf('id="pay-btn"') !== -1);

  console.log("\nTEST 2/3 – cancelled / failed / tampered payments");
  r = await c("POST", "/api/payment/order");
  check("order created server-side (₹499)", r.json.ok && r.json.amount === 49900 && r.json.keyId === "rzp_test_mock");
  check("secret never sent to browser", JSON.stringify(r.json).indexOf("mock_secret") === -1);
  const order1 = r.json.orderId;
  // cancelled: checkout closed → no verify call happens → still unpaid
  r = await c("GET", "/api/session");
  check("cancelled checkout → still not paid", r.json.paid === false);
  let bad = payOrder(order1);
  bad.razorpay_signature = "0".repeat(64);
  r = await c("POST", "/api/payment/verify", bad);
  check("forged signature rejected", r.status === 400 && r.json.code === "bad_signature");
  r = await c("GET", "/form");
  check("…and /form still blocked", r.status === 302 && r.location === "/payment");
  paymentOverride = { amount: 100 };
  r = await c("POST", "/api/payment/verify", payOrder(order1));
  check("wrong amount rejected", r.status === 400 && r.json.code === "mismatch");
  paymentOverride = { status: "failed" };
  r = await c("POST", "/api/payment/verify", payOrder(order1));
  check("failed payment rejected", r.status === 402 && r.json.code === "not_captured");
  paymentOverride = null;

  console.log("\nTEST 1 – verified payment → form");
  const paid = payOrder(order1, "authorized"); // authorized → captured by the server
  r = await c("POST", "/api/payment/verify", paid);
  check("valid payment verified", r.status === 200 && r.json.next === "/form", JSON.stringify(r.json));
  check("authorized payment was captured", db.payments[paid.razorpay_payment_id].status === "captured");
  r = await c("GET", "/form");
  check("/form now opens", r.status === 200 && r.text.indexOf('id="reg-form"') !== -1);
  r = await c("GET", "/thank-you");
  check("/thank-you still blocked → /form", r.status === 302 && r.location === "/form");

  console.log("\nTEST 7 – refresh / back button");
  r = await c("GET", "/form");
  check("refreshing /form keeps the payment", r.status === 200);
  r = await c("POST", "/api/payment/order");
  check("back to payment → no new order, sent to /form", r.json.alreadyPaid === true && r.json.next === "/form");
  r = await c("GET", "/api/session");
  check("session exposes only safe payment refs", r.json.paid && r.json.paymentId === paid.razorpay_payment_id &&
    r.json.amount === 49900 && !("signature" in r.json));

  console.log("\nTEST – form validation");
  r = await c("POST", "/api/register", { fullName: "", mobile: "12345", email: "nope", businessName: "" });
  check("invalid fields rejected with messages", r.status === 422 &&
    ["fullName", "mobile", "email", "businessName"].every(function (k) { return r.json.fields[k]; }));
  check("nothing stored on invalid submit", db.upserts === 0);

  console.log("\nTEST 6 – submit + double submit");
  const [a, b] = await Promise.all([c("POST", "/api/register", goodForm), c("POST", "/api/register", goodForm)]);
  check("submit succeeds → /thank-you", a.json.ok && a.json.next === "/thank-you");
  check("double-click → still one contact", Object.keys(db.contacts).length === 1);
  r = await c("POST", "/api/register", goodForm);
  check("submitting again later → no new registration", r.json.ok && r.json.duplicate === true);
  const contact = db.contacts["c_test@example.com"];
  check("contact stored with tags + normalised phone", contact && contact.phone === "+919876543210" &&
    contact.tags.indexOf("zrm-paid") !== -1);
  const notes = db.notes["c_test@example.com"] || [];
  check("payment reference note linked (" + notes.length + ")",
    notes.length >= 1 && notes[0].body.indexOf(paid.razorpay_payment_id) !== -1 && notes[0].body.indexOf(order1) !== -1);

  console.log("\nTEST 5 – thank you page");
  r = await c("GET", "/thank-you");
  check("/thank-you opens after registration", r.status === 200 && r.text.indexOf("Thank You") !== -1);
  r = await c("GET", "/form");
  check("going back to /form → /thank-you", r.status === 302 && r.location === "/thank-you");

  console.log("\nTEST – session tampering");
  const t = client(port);
  r = await t("GET", "/form");
  check("new visitor (no cookie) blocked", r.status === 302);

  server.close();
  console.log(failures ? "\n" + failures + " check(s) FAILED" : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})();
