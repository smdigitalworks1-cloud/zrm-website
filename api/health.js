/*
  GET /api/health
  Shows WHICH server settings are present – never their values – so a
  missing Vercel environment variable can be spotted without opening logs.
*/
module.exports = function handler(req, res) {
  function present(name) {
    return !!(process.env[name] && process.env[name].trim());
  }

  const keyId = (process.env.RAZORPAY_KEY_ID || "").trim();
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    environment: process.env.VERCEL_ENV || "local",
    RAZORPAY_KEY_ID: present("RAZORPAY_KEY_ID"),
    razorpayMode: keyId.indexOf("rzp_live_") === 0 ? "live" : keyId.indexOf("rzp_test_") === 0 ? "test" : "unknown",
    RAZORPAY_KEY_SECRET: present("RAZORPAY_KEY_SECRET"),
    SESSION_SECRET: present("SESSION_SECRET") && process.env.SESSION_SECRET.trim().length >= 32,
    GHL_PIT_TOKEN: present("GHL_PIT_TOKEN"),
    GHL_LOCATION_ID: present("GHL_LOCATION_ID")
  });
};
