/*
  Local development server – mimics the parts of Vercel this site uses:
  static files + cleanUrls, vercel.json redirects/rewrites, and the Node
  functions in /api (with req.query, req.body, res.status/json/send).

  Usage:   node scripts/dev-server.js        → http://localhost:3000
  Env:     reads .env.local (see .env.example). PORT overrides the port.
  No dependencies (Node 18+).
*/
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf",
  ".woff2": "font/woff2", ".ico": "image/x-icon", ".mp4": "video/mp4"
};

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, "utf8").split(/\r?\n/).forEach(function (line) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
}

// "/private/:path*" → RegExp
function pattern(source) {
  return new RegExp("^" + source.replace(/:\w+\*/g, ".*").replace(/:\w+/g, "[^/]+") + "$");
}

function enhance(res) {
  res.status = function (code) { res.statusCode = code; return res; };
  res.json = function (obj) {
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = function (data) { res.end(data); return res; };
  return res;
}

function readBody(req) {
  return new Promise(function (resolve) {
    let data = "";
    req.on("data", function (c) { data += c; });
    req.on("end", function () {
      if (!data) return resolve(undefined);
      if ((req.headers["content-type"] || "").indexOf("application/json") !== -1) {
        try { return resolve(JSON.parse(data)); } catch (e) { return resolve(data); }
      }
      resolve(data);
    });
  });
}

async function runFunction(file, req, res, query) {
  req.query = query;
  req.body = await readBody(req);
  delete require.cache[require.resolve(file)]; // pick up edits without restart
  const handler = require(file);
  try {
    await handler(req, enhance(res));
  } catch (err) {
    console.error(err);
    if (!res.headersSent) enhance(res).status(500).json({ error: "Function crashed" });
  }
}

function serveStatic(file, res) {
  res.setHeader("Content-Type", TYPES[path.extname(file).toLowerCase()] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}

function redirect(res, to) {
  res.statusCode = 307;
  res.setHeader("Location", to);
  res.end();
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  const query = Object.fromEntries(url.searchParams);

  // 1. redirects (before the filesystem, like Vercel)
  for (const r of config.redirects || []) {
    if (pattern(r.source).test(pathname)) return redirect(res, r.destination);
  }

  // 2. cleanUrls: /page.html → /page
  if (config.cleanUrls && /\.html$/.test(pathname)) {
    return redirect(res, pathname.replace(/(index)?\.html$/, "") || "/");
  }

  // 3. API functions
  if (pathname.indexOf("/api/") === 0) {
    const file = path.join(ROOT, pathname + ".js");
    if (!path.basename(file).startsWith("_") && fs.existsSync(file)) return runFunction(file, req, res, query);
  }

  // 4. static files (cleanUrls: /payment → payment.html)
  const candidates = pathname.endsWith("/")
    ? [path.join(ROOT, pathname, "index.html")]
    : [path.join(ROOT, pathname), path.join(ROOT, pathname + ".html")];
  for (const f of candidates) {
    if (f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile()) return serveStatic(f, res);
  }

  // 5. rewrites
  for (const r of config.rewrites || []) {
    if (pattern(r.source).test(pathname)) {
      const dest = new URL(r.destination, "http://localhost");
      const file = path.join(ROOT, dest.pathname + ".js");
      return runFunction(file, req, res, Object.assign({}, query, Object.fromEntries(dest.searchParams)));
    }
  }

  res.statusCode = 404;
  res.end("Not found");
}

function createServer() {
  return http.createServer(function (req, res) { handle(req, res); });
}

module.exports = { createServer, loadEnv };

if (require.main === module) {
  loadEnv();
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, function () {
    console.log("ZRM dev server → http://localhost:" + port);
    ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "SESSION_SECRET", "GHL_PIT_TOKEN", "GHL_LOCATION_ID"].forEach(function (k) {
      if (!process.env[k]) console.warn("  ⚠ " + k + " is not set (.env.local)");
    });
  });
}
