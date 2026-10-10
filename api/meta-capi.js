/*
  POST /api/meta-capi  →  Meta Conversions API (server side copy of the Pixel event)

  Vercel version of meta-capi.php (that file is for Hostinger). Same input and
  same event payload; the access token never reaches the browser.

  Vercel environment variables (Project → Settings → Environment Variables):
    FB_ACCESS_TOKEN  – Conversions API access token (required)
    FB_PIXEL_ID      – optional, defaults to the site's Pixel id

  Until FB_ACCESS_TOKEN is set the endpoint answers 204 and sends nothing,
  so the page has no failing request.
*/
const crypto = require("crypto");

const DEFAULT_PIXEL_ID = "1452662180104631";
const HASHED_FIELDS = ["em", "ph", "fn", "ln", "ct", "st", "zp", "country"];

function readCookie(header, name) {
  const match = new RegExp("(?:^|;\\s*)" + name + "=([^;]+)").exec(header || "");
  return match ? decodeURIComponent(match[1]) : null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = (process.env.FB_ACCESS_TOKEN || "").trim();
  const pixelId = (process.env.FB_PIXEL_ID || DEFAULT_PIXEL_ID).trim();
  if (!token) {
    res.status(204).end();
    return;
  }

  let input = req.body || {};
  if (typeof input === "string") {
    try { input = JSON.parse(input); } catch (e) { input = {}; }
  }

  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const headers = req.headers || {};
  const forwarded = str(headers["x-forwarded-for"]).split(",")[0].trim();

  const userData = {
    client_ip_address: forwarded || (req.socket && req.socket.remoteAddress) || "",
    client_user_agent: str(headers["user-agent"])
  };
  const fbp = readCookie(headers.cookie, "_fbp") || str(input.fbp);
  const fbc = readCookie(headers.cookie, "_fbc") || str(input.fbc);
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  if (input.user_data && typeof input.user_data === "object") {
    HASHED_FIELDS.forEach((key) => {
      const v = input.user_data[key];
      if (typeof v === "string" && v !== "") userData[key] = sha256(v);
    });
  }

  const event = {
    event_name: str(input.event_name) || "PageView",
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    event_source_url: str(input.event_source_url) || str(headers.referer),
    user_data: userData
  };
  if (str(input.event_id)) event.event_id = str(input.event_id);
  if (input.custom_data && typeof input.custom_data === "object") event.custom_data = input.custom_data;

  try {
    const response = await fetch(
      "https://graph.facebook.com/v19.0/" + encodeURIComponent(pixelId) +
        "/events?access_token=" + encodeURIComponent(token),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [event] }),
        signal: AbortSignal.timeout(5000)
      }
    );
    const body = await response.text();
    res.status(response.ok ? 200 : 502).setHeader("Content-Type", "application/json");
    res.end(body || JSON.stringify({ status: response.ok ? "ok" : "failed" }));
  } catch (err) {
    res.status(502).json({ status: "failed" });
  }
};
