<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function respond($status, $data) {
  http_response_code($status);
  echo json_encode($data);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  respond(405, ['error' => 'Method not allowed']);
}

$config = is_file(__DIR__ . '/meta-config.php') ? include __DIR__ . '/meta-config.php' : [];
$pixelId = isset($config['FB_PIXEL_ID']) ? trim($config['FB_PIXEL_ID']) : '';
$accessToken = isset($config['FB_ACCESS_TOKEN']) ? trim($config['FB_ACCESS_TOKEN']) : '';

if (empty($pixelId) || empty($accessToken)) {
  respond(503, ['error' => 'Meta CAPI not configured']);
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?: [];

$eventName = isset($input['event_name']) && is_string($input['event_name']) ? trim($input['event_name']) : 'PageView';
$eventId = isset($input['event_id']) && is_string($input['event_id']) ? trim($input['event_id']) : null;
$eventSourceUrl = isset($input['event_source_url']) && is_string($input['event_source_url']) ? trim($input['event_source_url']) : (isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : 'https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']);

// Detect client IP
$clientIp = '';
if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
  $clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'];
} elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
  $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
  $clientIp = trim($parts[0]);
} elseif (!empty($_SERVER['REMOTE_ADDR'])) {
  $clientIp = $_SERVER['REMOTE_ADDR'];
}

$userAgent = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';

// Get Meta cookies
$fbp = isset($_COOKIE['_fbp']) ? $_COOKIE['_fbp'] : (isset($input['fbp']) ? $input['fbp'] : null);
$fbc = isset($_COOKIE['_fbc']) ? $_COOKIE['_fbc'] : (isset($input['fbc']) ? $input['fbc'] : null);

$userData = [
  'client_ip_address' => $clientIp,
  'client_user_agent' => $userAgent,
];
if ($fbp) $userData['fbp'] = $fbp;
if ($fbc) $userData['fbc'] = $fbc;

if (!empty($input['user_data']) && is_array($input['user_data'])) {
  foreach ($input['user_data'] as $k => $v) {
    if (in_array($k, ['em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country'], true) && is_string($v) && $v !== '') {
      $userData[$k] = hash('sha256', strtolower(trim($v)));
    }
  }
}

$eventData = [
  'event_name' => $eventName,
  'event_time' => time(),
  'action_source' => 'website',
  'event_source_url' => $eventSourceUrl,
  'user_data' => $userData,
];

if (!empty($eventId)) {
  $eventData['event_id'] = $eventId;
}

if (!empty($input['custom_data']) && is_array($input['custom_data'])) {
  $eventData['custom_data'] = $input['custom_data'];
}

$payload = [
  'data' => [$eventData]
];

$url = "https://graph.facebook.com/v19.0/" . rawurlencode($pixelId) . "/events?access_token=" . rawurlencode($accessToken);

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 5,
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode($payload),
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode >= 200 && $httpCode < 300 ? 200 : $httpCode);
echo $response ?: json_encode(['status' => 'failed']);
