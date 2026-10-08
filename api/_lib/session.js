/*
  Signed session cookie for the payment → form → thank-you flow.

  The cookie only holds safe references (payment id, order id, amount, time,
  registration flag). It is HttpOnly and HMAC-signed with SESSION_SECRET, so
  the browser cannot read it with JS and cannot forge "paid" or "registered".
*/
const crypto = require("crypto");

const COOKIE = "zrm_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days – long enough to finish the form later

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET missing or too short");
  return s;
}

function sign(data) {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

function encode(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return data + "." + sign(data);
}

function decode(value) {
  if (!value || value.indexOf(".") === -1) return null;
  const [data, mac] = value.split(".");
  const expected = sign(data);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  const parts = header.split(";");
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (p.indexOf(name + "=") === 0) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

// returns the verified session or null
function getSession(req) {
  try {
    return decode(readCookie(req, COOKIE));
  } catch (e) {
    return null;
  }
}

function setSession(req, res, payload) {
  payload.exp = Date.now() + MAX_AGE * 1000;
  const secure = (req.headers["x-forwarded-proto"] || "").indexOf("https") !== -1 || process.env.VERCEL;
  const cookie = COOKIE + "=" + encodeURIComponent(encode(payload)) +
    "; Path=/; Max-Age=" + MAX_AGE + "; HttpOnly; SameSite=Lax" + (secure ? "; Secure" : "");
  res.setHeader("Set-Cookie", cookie);
}

module.exports = { getSession, setSession };
