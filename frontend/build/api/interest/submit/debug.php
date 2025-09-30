<?php
// Simple test script to debug reCAPTCHA configuration
// DO NOT deploy this to production - it exposes sensitive information

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['error' => 'method_not_allowed']);
  exit;
}

$recaptchaSecret = getenv('RECAPTCHA_SECRET_KEY') ?: $_ENV['RECAPTCHA_SECRET_KEY'] ?? $_SERVER['RECAPTCHA_SECRET_KEY'] ?? null;
$accessKey = getenv('WEB3FORMS_ACCESS_KEY') ?: getenv('WEB_ACCESS_KEY') ?: $_ENV['WEB3FORMS_ACCESS_KEY'] ?? $_ENV['WEB_ACCESS_KEY'] ?? $_SERVER['WEB3FORMS_ACCESS_KEY'] ?? $_SERVER['WEB_ACCESS_KEY'] ?? null;

$info = [
  'php_version' => phpversion(),
  'has_recaptcha_secret' => !empty($recaptchaSecret),
  'recaptcha_secret_length' => $recaptchaSecret ? strlen($recaptchaSecret) : 0,
  'recaptcha_secret_starts_with' => $recaptchaSecret ? substr($recaptchaSecret, 0, 10) . '...' : 'not set',
  'has_web3forms_key' => !empty($accessKey),
  'web3forms_key_length' => $accessKey ? strlen($accessKey) : 0,
  'web3forms_key_starts_with' => $accessKey ? substr($accessKey, 0, 10) . '...' : 'not set',
  'file_get_contents_enabled' => function_exists('file_get_contents') && ini_get('allow_url_fopen'),
  'curl_enabled' => function_exists('curl_init'),
  'openssl_enabled' => extension_loaded('openssl'),
  'server_time' => date('Y-m-d H:i:s T'),
];

// Test reCAPTCHA API connectivity (without sending actual secret)
$testUrl = 'https://www.google.com/recaptcha/api/siteverify';
$testContext = stream_context_create([
  'http' => [
    'method' => 'POST',
    'header' => "Content-type: application/x-www-form-urlencoded\r\n",
    'content' => http_build_query(['secret' => 'test', 'response' => 'test'])
  ]
]);

$testResponse = @file_get_contents($testUrl, false, $testContext);
$info['can_reach_recaptcha_api'] = $testResponse !== false;
$info['recaptcha_api_test_response'] = $testResponse ? 'received response' : 'failed to connect';

echo json_encode($info, JSON_PRETTY_PRINT);
?>