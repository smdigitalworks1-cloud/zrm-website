/*
  GET /api/page?p=form | thank-you   (served at /form and /thank-you via vercel.json)

  The protected pages live in /private (not publicly reachable). They are only
  sent when the signed session allows it:
    /form       → verified payment, not yet registered
    /thank-you  → verified payment AND completed registration
  Otherwise the visitor is redirected to the right step.
*/
const fs = require("fs");
const path = require("path");
const { getSession } = require("./_lib/session");

const PAGES = { form: "form.html", "thank-you": "thank-you.html" };

function redirect(res, to) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", to);
  res.status(302).end();
}

module.exports = function handler(req, res) {
  const page = String((req.query && req.query.p) || "");
  if (!PAGES[page]) { redirect(res, "/"); return; }

  const s = getSession(req);
  const paid = !!(s && s.status === "paid");
  const registered = paid && !!s.registered;

  if (!paid) { redirect(res, "/payment"); return; }
  if (page === "form" && registered) { redirect(res, "/thank-you"); return; }
  if (page === "thank-you" && !registered) { redirect(res, "/form"); return; }

  const html = fs.readFileSync(path.join(process.cwd(), "private", PAGES[page]), "utf8");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(html);
};
