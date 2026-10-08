/*
  POST /api/register  { fullName, mobile, email, businessName }

  Only works with a verified payment session. Validates on the server,
  stores the registration in GHL (contact + tags + payment reference note)
  and marks the session as registered. Re-submitting the same payment does
  not create another registration.
*/
const { send, fail, onlyPost, body } = require("./_lib/http");
const { getSession, setSession } = require("./_lib/session");
const ghl = require("./_lib/ghl");

function clean(v, max) {
  return String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
}

// returns { values, errors }
function validate(b) {
  const values = {
    fullName: clean(b.fullName, 80),
    mobile: String(b.mobile || "").replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""),
    email: clean(b.email, 120).toLowerCase(),
    businessName: clean(b.businessName, 120)
  };
  const errors = {};
  if (values.fullName.length < 2) errors.fullName = "Please enter your full name.";
  if (!/^[6-9]\d{9}$/.test(values.mobile)) errors.mobile = "Please enter a valid 10-digit mobile number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) errors.email = "Please enter a valid email address.";
  if (values.businessName.length < 2) errors.businessName = "Please enter your business name.";
  return { values, errors };
}

module.exports = async function handler(req, res) {
  if (!onlyPost(req, res)) return;

  const session = getSession(req);
  if (!session || session.status !== "paid") {
    fail(res, 401, "Your payment session has expired. Please complete the payment first.", "no_payment");
    return;
  }
  if (session.registered) {
    send(res, 200, { ok: true, next: "/thank-you", duplicate: true });
    return;
  }

  const { values, errors } = validate(body(req));
  if (Object.keys(errors).length) {
    send(res, 422, { ok: false, code: "invalid", error: "Please check the highlighted fields.", fields: errors });
    return;
  }

  try {
    const contactId = await ghl.upsertContact({
      fullName: values.fullName,
      email: values.email,
      phone: "+91" + values.mobile,
      businessName: values.businessName
    });
    await ghl.addPaymentNote(contactId, session);

    session.registered = true;
    session.registeredAt = new Date().toISOString();
    setSession(req, res, session);

    send(res, 200, { ok: true, next: "/thank-you" });
  } catch (err) {
    console.error("register:", err.message);
    fail(res, 502, "We couldn't save your details right now. Your payment is safe – please try again.", "save_failed");
  }
};

module.exports.validate = validate;
