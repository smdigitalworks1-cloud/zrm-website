<?php
/*
  GET /api/zrm-values  →  { zrm_online_date, 02_zrm_online_time, zrm_replay, zrm_group_link }

  Hostinger version of api/zrm-values.js (.htaccess rewrites /api/zrm-values
  here). Returns ONLY these four GHL custom values, so the token never
  reaches the browser. The token lives in zrm-config.php next to this file
  (blocked by .htaccess, never committed – this repo is public):

    <?php
    return [
      'GHL_PIT_TOKEN'   => 'pit-…',
      'GHL_LOCATION_ID' => '…',
    ];

  Values are cached for 60 s only, so a change in GHL → Settings → Custom
  Values shows on the site within a minute. Open /api/zrm-values?fresh=1
  to skip the cache straight away.
*/
$KEYS = ['zrm_online_date', '02_zrm_online_time', 'zrm_replay', 'zrm_group_link'];
$CACHE_SECONDS = 60;
$cacheFile = __DIR__ . '/.zrm-cache.json';

header('Content-Type: application/json; charset=utf-8');
// never let the browser or the Hostinger CDN keep an old copy
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('CDN-Cache-Control: no-store');
header('Pragma: no-cache');

function respond($status, $json) {
  http_response_code($status);
  echo $json;
  exit;
}

$fresh = isset($_GET['fresh']);
if (!$fresh && is_file($cacheFile) && time() - filemtime($cacheFile) < $CACHE_SECONDS) {
  $cached = file_get_contents($cacheFile);
  if ($cached !== false) respond(200, $cached);
}

$config = is_file(__DIR__ . '/zrm-config.php') ? include __DIR__ . '/zrm-config.php' : [];
$token = is_array($config) && isset($config['GHL_PIT_TOKEN']) ? trim($config['GHL_PIT_TOKEN']) : '';
$location = is_array($config) && isset($config['GHL_LOCATION_ID']) ? trim($config['GHL_LOCATION_ID']) : '';
if ($token === '' || $location === '') {
  respond(503, '{"error":"GHL values not configured"}');
}

$ch = curl_init('https://services.leadconnectorhq.com/locations/' . rawurlencode($location) . '/customValues');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 10,
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer ' . $token,
    'Version: 2021-07-28',
    'Accept: application/json',
  ],
]);
$raw = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = $raw !== false && $status >= 200 && $status < 300 ? json_decode($raw, true) : null;
if (!is_array($data)) {
  // GHL is down: serve the last good values if there are any
  if (is_file($cacheFile)) respond(200, file_get_contents($cacheFile));
  respond(502, '{"error":"Could not load GHL values"}');
}

$values = new stdClass();
foreach (isset($data['customValues']) ? $data['customValues'] : [] as $item) {
  // fieldKey looks like "{{ custom_values.zrm_replay }}"
  if (preg_match('/custom_values\.(\w+)/', isset($item['fieldKey']) ? $item['fieldKey'] : '', $m)
      && in_array($m[1], $KEYS, true)) {
    $values->{$m[1]} = isset($item['value']) ? $item['value'] : '';
  }
}

$json = json_encode($values, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
@file_put_contents($cacheFile, $json, LOCK_EX);
respond(200, $json);
