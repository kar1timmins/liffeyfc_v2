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
  'user_agent_restriction' => ini_get('user_agent'),
  'max_execution_time' => ini_get('max_execution_time'),
  'server_time' => date('Y-m-d H:i:s T'),
];

// Test reCAPTCHA API connectivity with cURL
if (function_exists('curl_init')) {
  $ch = curl_init();
  curl_setopt($ch, CURLOPT_URL, 'https://www.google.com/recaptcha/api/siteverify');
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query(['secret' => 'test', 'response' => 'test']));
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
  curl_setopt($ch, CURLOPT_TIMEOUT, 10);
  curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (compatible; reCAPTCHA verification)');
  
  $curlResponse = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $curlError = curl_error($ch);
  curl_close($ch);
  
  $info['curl_test'] = [
    'success' => $curlResponse !== false,
    'http_code' => $httpCode,
    'error' => $curlError,
    'response_length' => $curlResponse ? strlen($curlResponse) : 0
  ];
} else {
  $info['curl_test'] = 'cURL not available';
}

// Test file_get_contents connectivity
if (ini_get('allow_url_fopen')) {
  $context = stream_context_create([
    'http' => [
      'method' => 'POST',
      'header' => "Content-type: application/x-www-form-urlencoded\r\n",
      'content' => http_build_query(['secret' => 'test', 'response' => 'test']),
      'timeout' => 10
    ]
  ]);
  
  $fgcResponse = @file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, $context);
  
  $info['file_get_contents_test'] = [
    'success' => $fgcResponse !== false,
    'response_length' => $fgcResponse ? strlen($fgcResponse) : 0
  ];
} else {
  $info['file_get_contents_test'] = 'allow_url_fopen disabled';
}

echo json_encode($info, JSON_PRETTY_PRINT);
?>