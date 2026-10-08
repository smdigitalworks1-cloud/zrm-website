/*
  GoHighLevel (LeadConnector) calls – the CRM is where registrations are stored.
  Uses the same GHL_PIT_TOKEN / GHL_LOCATION_ID env vars as api/zrm-values.js.
  The private integration token needs the contacts read/write scopes.
*/
const BASE = "https://services.leadconnectorhq.com";

function config() {
  const token = process.env.GHL_PIT_TOKEN;
  const location = process.env.GHL_LOCATION_ID;
  if (!token || !location) throw new Error("GHL env vars missing");
  return { token, location };
}

async function call(method, path, payload) {
  const { token } = config();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      Version: "2021-07-28",
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error("GHL " + path + " → " + res.status);
  return data;
}

// create or update the contact (matched by email / phone) → contact id
async function upsertContact(reg) {
  const { location } = config();
  const data = await call("POST", "/contacts/upsert", {
    locationId: location,
    name: reg.fullName,
    email: reg.email,
    phone: reg.phone,
    companyName: reg.businessName,
    source: "ZRM website – paid registration",
    tags: ["zrm-paid", "zrm-registered"]
  });
  const id = data.contact && data.contact.id;
  if (!id) throw new Error("GHL upsert returned no contact id");
  return id;
}

// payment reference on the contact – added once per payment id
async function addPaymentNote(contactId, session) {
  const existing = await call("GET", "/contacts/" + encodeURIComponent(contactId) + "/notes");
  const already = (existing.notes || []).some(function (n) {
    return (n.body || "").indexOf(session.paymentId) !== -1;
  });
  if (already) return;

  await call("POST", "/contacts/" + encodeURIComponent(contactId) + "/notes", {
    body: [
      "ZRM registration – payment verified",
      "Product: " + session.product,
      "Amount: ₹" + (session.amount / 100),
      "Razorpay payment id: " + session.paymentId,
      "Razorpay order id: " + session.orderId,
      "Paid at: " + session.paidAt
    ].join("\n")
  });
}

module.exports = { upsertContact, addPaymentNote };
