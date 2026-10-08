/* Small helpers shared by the API functions. */

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

// user-facing error: only a safe message, never the raw upstream error
function fail(res, status, message, code) {
  send(res, status, { ok: false, error: message, code: code || "error" });
}

function onlyPost(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    fail(res, 405, "Method not allowed.", "method");
    return false;
  }
  return true;
}

// Vercel parses JSON bodies; fall back to a string body just in case
function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return {};
}

module.exports = { send, fail, onlyPost, body };
