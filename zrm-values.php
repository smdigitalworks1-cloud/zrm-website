<?php
// Returns the ZRM custom values from GHL as JSON for the landing pages.
// The GHL token stays on the server (zrm-config.php); responses are cached
// for 5 minutes so every page view does not hit the GHL API.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60');

$keys = ['zrm_online_date', '02_zrm_online_time', 'zrm_replay', 'zrm_group_link'];
$cacheFile = __DIR__ . '/.zrm-cache.json';
$cacheTtl = 300;

if (is_file($cacheFile) && time() - filemtime($cacheFile) < $cacheTtl) {
    readfile($cacheFile);
    exit;
}

$config = require __DIR__ . '/zrm-config.php';

$ch = curl_init('https://services.leadconnectorhq.com/locations/' . rawurlencode($config['location_id']) . '/customValues');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $config['token'],
        'Version: 2021-07-28',
        'Accept: application/json',
    ],
]);
$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = $status === 200 ? json_decode($body, true) : null;

if (!is_array($data) || !isset($data['customValues'])) {
    // Serve the last good values if GHL is down; otherwise the pages keep their built-in text
    if (is_file($cacheFile)) {
        readfile($cacheFile);
    } else {
        http_response_code(502);
        echo '{}';
    }
    exit;
}

// fieldKey looks like "{{ custom_values.zrm_online_date }}"
$values = [];
foreach ($data['customValues'] as $cv) {
    $fieldKey = isset($cv['fieldKey']) ? $cv['fieldKey'] : '';
    if (preg_match('/custom_values\.([A-Za-z0-9_]+)/', $fieldKey, $m) && in_array($m[1], $keys, true)) {
        $values[$m[1]] = (string) $cv['value'];
    }
}

$json = json_encode($values, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
file_put_contents($cacheFile, $json, LOCK_EX);
echo $json;
