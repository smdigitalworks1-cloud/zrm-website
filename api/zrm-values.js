/*
  GET /api/zrm-values  →  { zrm_online_date, 02_zrm_online_time, zrm_replay, zrm_group_link }

  Vercel serverless function. Reads the ZRM custom values from GoHighLevel
  and returns ONLY these four keys, so the private integration token never
  reaches the browser (this repo is public – never put the token in code).

  Required Vercel environment variables (Project → Settings → Environment Variables):
    GHL_PIT_TOKEN    – GoHighLevel private integration token (pit-…)
    GHL_LOCATION_ID  – GoHighLevel location id
*/
const KEYS = ["zrm_online_date", "02_zrm_online_time", "zrm_replay", "zrm_group_link"];

module.exports = async function handler(req, res) {
  const token = process.env.GHL_PIT_TOKEN;
  const location = process.env.GHL_LOCATION_ID;

  if (!token || !location) {
    res.status(503).json({ error: "GHL values not configured" });
    return;
  }

  try {
    const response = await fetch(
      "https://services.leadconnectorhq.com/locations/" + encodeURIComponent(location) + "/customValues",
      {
        headers: {
          Authorization: "Bearer " + token,
          Version: "2021-07-28",
          Accept: "application/json"
        }
      }
    );
    if (!response.ok) throw new Error("GHL responded " + response.status);

    const data = await response.json();
    const values = {};
    (data.customValues || []).forEach(function (item) {
      // fieldKey looks like "{{ custom_values.zrm_replay }}"
      const match = /custom_values\.([\w]+)/.exec(item.fieldKey || "");
      if (match && KEYS.indexOf(match[1]) !== -1) values[match[1]] = item.value;
    });

    // cached at the edge for 5 min, so GHL is not called on every page view
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json(values);
  } catch (err) {
    res.status(502).json({ error: "Could not load GHL values" });
  }
};
