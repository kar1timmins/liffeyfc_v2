<?php
// PHP relay for form submissions using Resend API
// Expects JSON body and environment variables in server config (.htaccess SetEnv or control panel):
//   RECAPTCHA_SECRET_KEY
//   RESEND_API_KEY
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// Debug logging
error_log("Interest form submission - Method: " . $_SERVER['REQUEST_METHOD']);
error_log("Interest form submission - Content-Type: " . ($_SERVER['CONTENT_TYPE'] ?? 'not set'));

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  error_log("Interest form submission - Invalid method: " . $_SERVER['REQUEST_METHOD']);
  http_response_code(405);
  echo json_encode(['error' => 'method_not_allowed', 'method' => $_SERVER['REQUEST_METHOD']]);
  exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
  http_response_code(400);
  echo json_encode(['error' => 'invalid_json']);
  exit;
}

$required = ['name','email','pitchedBefore','interest','event_year','event_quarter','consent','recaptchaToken'];
$errors = [];
$name = trim($data['name'] ?? '');
$email = trim($data['email'] ?? '');
$pitchedBefore = $data['pitchedBefore'] ?? '';
$interest = $data['interest'] ?? '';
$message = $data['message'] ?? '';
$event_year = $data['event_year'] ?? null;
$event_quarter = $data['event_quarter'] ?? '';
$consent = $data['consent'] ?? false;
$recaptchaToken = $data['recaptchaToken'] ?? '';

if (strlen($name) < 2) $errors['name'] = 'Full name must be at least 2 characters.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Enter a valid email address.';
if (!in_array($pitchedBefore, ['Yes','No'], true)) $errors['pitchedBefore'] = 'Please select if you have pitched before.';
$allowedInterests = ['Attending','Pitching my business','Investing / Partnering'];
if (!in_array($interest, $allowedInterests, true)) $errors['interest'] = 'Select a valid interest option.';
if (!$consent) $errors['consent'] = 'Consent is required.';
if ($message && strlen($message) > 1500) $errors['message'] = 'Message is too long (max 1500 characters).';
$year = (int)date('Y');
if (!is_numeric($event_year) || $event_year < $year -1 || $event_year > $year +1) $errors['event_year'] = 'Invalid event year.';
if (!preg_match('/^Q[1-4]$/', $event_quarter)) $errors['event_quarter'] = 'Invalid event quarter.';

if ($errors) {
  http_response_code(400);
  echo json_encode(['error' => 'validation_failed','errors' => $errors]);
  exit;
}

if (!$recaptchaToken) {
  http_response_code(400);
  echo json_encode(['error' => 'missing_recaptcha_token']);
  exit;
}

$recaptchaSecret = getenv('RECAPTCHA_SECRET_KEY') ?: $_ENV['RECAPTCHA_SECRET_KEY'] ?? $_SERVER['RECAPTCHA_SECRET_KEY'] ?? null;
if (!$recaptchaSecret) {
  error_log("Interest form submission - Missing RECAPTCHA_SECRET_KEY in environment");
  http_response_code(500);
  echo json_encode(['error' => 'missing_recaptcha_secret']);
  exit;
}

// Verify reCAPTCHA
error_log("Interest form submission - Attempting reCAPTCHA verification");
error_log("Interest form submission - Token length: " . strlen($recaptchaToken));

$recaptchaData = [
  'secret' => $recaptchaSecret,
  'response' => $recaptchaToken
];

$recaptchaResponse = false;
$recaptchaJson = null;

// Try cURL first (more reliable on shared hosting)
if (function_exists('curl_init')) {
  error_log("Interest form submission - Using cURL for reCAPTCHA verification");
  $ch = curl_init();
  curl_setopt($ch, CURLOPT_URL, 'https://www.google.com/recaptcha/api/siteverify');
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($recaptchaData));
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
  curl_setopt($ch, CURLOPT_TIMEOUT, 30);
  curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (compatible; reCAPTCHA verification)');
  
  $recaptchaResponse = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $curlError = curl_error($ch);
  curl_close($ch);
  
  if ($recaptchaResponse === false) {
    error_log("Interest form submission - cURL failed: " . $curlError);
  } else {
    error_log("Interest form submission - cURL success, HTTP code: " . $httpCode);
  }
}

// Fallback to file_get_contents if cURL failed
if ($recaptchaResponse === false && ini_get('allow_url_fopen')) {
  error_log("Interest form submission - Falling back to file_get_contents");
  $recaptchaResponse = file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, stream_context_create([
    'http' => [
      'method' => 'POST',
      'header' => "Content-type: application/x-www-form-urlencoded\r\n",
      'content' => http_build_query($recaptchaData)
    ]
  ]));
}

if ($recaptchaResponse === false) {
  error_log("Interest form submission - Failed to contact reCAPTCHA API with both methods");
  http_response_code(400);
  echo json_encode([
    'error' => 'recaptcha_api_unreachable',
    'details' => 'Server cannot reach Google reCAPTCHA API. Please contact administrator.',
    'curl_available' => function_exists('curl_init'),
    'url_fopen_enabled' => ini_get('allow_url_fopen')
  ]);
  exit;
}

error_log("Interest form submission - reCAPTCHA API response: " . $recaptchaResponse);

$recaptchaJson = json_decode($recaptchaResponse, true);
if (!$recaptchaJson) {
  error_log("Interest form submission - Invalid JSON response from reCAPTCHA API");
  http_response_code(400);
  echo json_encode(['error' => 'recaptcha_invalid_response', 'raw_response' => $recaptchaResponse]);
  exit;
}

if (empty($recaptchaJson['success'])) {
  error_log("Interest form submission - reCAPTCHA verification failed: " . json_encode($recaptchaJson));
  http_response_code(400);
  echo json_encode(['error' => 'recaptcha_verification_failed','detail' => $recaptchaJson]);
  exit;
}

// For reCAPTCHA v3, check the score (v2 compatibility maintained)
$scoreThreshold = 0.5; // Adjust as needed (0.0 = very likely bot, 1.0 = very likely human)
if (isset($recaptchaJson['score']) && $recaptchaJson['score'] < $scoreThreshold) {
  http_response_code(400);
  echo json_encode(['error' => 'recaptcha_score_too_low', 'score' => $recaptchaJson['score'], 'threshold' => $scoreThreshold]);
  exit;
}

$accessKey = getenv('RESEND_API_KEY') ?: $_ENV['RESEND_API_KEY'] ?? $_SERVER['RESEND_API_KEY'] ?? null;
if (!$accessKey) {
  error_log("Interest form submission - Missing RESEND_API_KEY in environment");
  http_response_code(500);
  echo json_encode(['error' => 'missing_resend_key']);
  exit;
}

// Validate API key format (Resend keys start with 're_')
if (!preg_match('/^re_[A-Za-z0-9_]+$/', $accessKey)) {
  error_log("Interest form submission - Invalid Resend API key format: " . substr($accessKey, 0, 8) . "...");
  http_response_code(500);
  echo json_encode([
    'error' => 'invalid_resend_key_format',
    'details' => 'Resend API key should start with "re_"',
    'key_preview' => substr($accessKey, 0, 8) . '...'
  ]);
  exit;
}

// Create email content
$emailContent = "
<h2>New Interest Form Submission</h2>
<p><strong>Name:</strong> " . htmlspecialchars($name) . "</p>
<p><strong>Email:</strong> " . htmlspecialchars($email) . "</p>
<p><strong>Has pitched before:</strong> " . htmlspecialchars($pitchedBefore) . "</p>
<p><strong>Interest:</strong> " . htmlspecialchars($interest) . "</p>
<p><strong>Event:</strong> " . htmlspecialchars($event_quarter) . " " . htmlspecialchars($event_year) . "</p>
<p><strong>Message:</strong></p>
<p>" . nl2br(htmlspecialchars($message)) . "</p>
<p><strong>Consent given:</strong> " . ($consent ? 'Yes' : 'No') . "</p>
<hr>
<p><em>Submitted at: " . date('Y-m-d H:i:s T') . "</em></p>
";

$payload = [
  'from' => 'noreply@liffeyfoundersclub.com',
  'to' => ['info@liffeyfoundersclub.com'],
  'subject' => 'New Interest Form Submission from ' . $name,
  'html' => $emailContent,
  'reply_to' => $email
];

error_log("Interest form submission - Submitting to Resend with API key: " . substr($accessKey, 0, 8) . "...");
error_log("Interest form submission - Email to: info@liffeyfoundersclub.com");
error_log("Interest form submission - From: " . $name . " (" . $email . ")");

// Try cURL first for Resend submission
$resendResponse = false;
$responseHeaders = '';
if (function_exists('curl_init')) {
  $curl = curl_init();
  curl_setopt_array($curl, [
    CURLOPT_URL => 'https://api.resend.com/emails',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_HTTPHEADER => [
      'Content-Type: application/json',
      'Authorization: Bearer ' . $accessKey,
      'User-Agent: LiffeyFC-ContactForm/1.0'
    ],
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 3,
    CURLOPT_ENCODING => '',  // Enable compression
    CURLOPT_HEADERFUNCTION => function($curl, $header) use (&$responseHeaders) {
      $responseHeaders .= $header;
      return strlen($header);
    }
  ]);
  
  $resendResponse = curl_exec($curl);
  $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
  $curlError = curl_error($curl);
  curl_close($curl);
  
  if ($resendResponse === false || !empty($curlError)) {
    error_log("Interest form submission - cURL failed for Resend: " . $curlError);
    error_log("Interest form submission - cURL info: HTTP Code: $httpCode, Error: $curlError");
    $resendResponse = false;
  } else {
    error_log("Interest form submission - Resend cURL success, HTTP code: " . $httpCode);
    error_log("Interest form submission - Response headers: " . trim($responseHeaders));
    
    // Log error responses for debugging
    if ($httpCode >= 400) {
      error_log("Interest form submission - Got HTTP $httpCode from Resend");
      error_log("Interest form submission - Error response body: " . substr($resendResponse, 0, 500));
    }
  }
}

// Fallback to file_get_contents if cURL failed
if ($resendResponse === false && ini_get('allow_url_fopen')) {
  error_log("Interest form submission - Trying file_get_contents fallback for Resend");
  $resendContext = stream_context_create([
    'http' => [
      'method' => 'POST',
      'header' => "Content-Type: application/json\r\n" .
                  "Authorization: Bearer " . $accessKey . "\r\n" .
                  "User-Agent: LiffeyFC-ContactForm/1.0\r\n",
      'content' => json_encode($payload),
      'timeout' => 30,
      'follow_location' => 1,
      'max_redirects' => 3
    ]
  ]);
  
  $resendResponse = file_get_contents('https://api.resend.com/emails', false, $resendContext);
  if ($resendResponse === false) {
    $error = error_get_last();
    error_log("Interest form submission - file_get_contents also failed for Resend");
    error_log("Interest form submission - file_get_contents error: " . ($error['message'] ?? 'Unknown error'));
  } else {
    error_log("Interest form submission - Resend file_get_contents success");
  }
}

if ($web3formsResponse === false) {
  error_log("Interest form submission - All methods failed to contact Web3Forms API");
  
  // Gather diagnostic information
  $diagnostics = [
    'curl_available' => function_exists('curl_init'),
    'url_fopen_enabled' => ini_get('allow_url_fopen'),
    'openssl_loaded' => extension_loaded('openssl'),
    'user_agent_set' => !empty(ini_get('user_agent')),
    'server_time' => date('Y-m-d H:i:s T'),
    'php_version' => PHP_VERSION
  ];
  
  // Try a simple connectivity test
  $testConnectivity = false;
  if (function_exists('curl_init')) {
if ($resendResponse === false) {
  error_log("Interest form submission - All methods failed to contact Resend API");
  
  // Gather diagnostic information
  $diagnostics = [
    'curl_available' => function_exists('curl_init'),
    'url_fopen_enabled' => ini_get('allow_url_fopen'),
    'openssl_loaded' => extension_loaded('openssl'),
    'user_agent_set' => !empty(ini_get('user_agent')),
    'server_time' => date('Y-m-d H:i:s T'),
    'php_version' => PHP_VERSION
  ];
  
  // Try a simple connectivity test
  $testConnectivity = false;
  if (function_exists('curl_init')) {
    $testCurl = curl_init();
    curl_setopt_array($testCurl, [
      CURLOPT_URL => 'https://api.resend.com',
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_TIMEOUT => 10,
      CURLOPT_NOBODY => true,
      CURLOPT_SSL_VERIFYPEER => false  // Disable SSL verification for test
    ]);
    $testResult = curl_exec($testCurl);
    $testHttpCode = curl_getinfo($testCurl, CURLINFO_HTTP_CODE);
    curl_close($testCurl);
    
    if ($testResult !== false && $testHttpCode > 0) {
      $testConnectivity = "HTTP $testHttpCode";
    }
  }
  
  $diagnostics['basic_connectivity'] = $testConnectivity;
  
  error_log("Interest form submission - Diagnostics: " . json_encode($diagnostics));
  
  http_response_code(502);
  echo json_encode([
    'error' => 'resend_api_unreachable',
    'details' => 'Server cannot reach Resend API after trying both cURL and file_get_contents methods.',
    'diagnostics' => $diagnostics,
    'troubleshooting' => [
      'Check server firewall settings for outbound HTTPS connections',
      'Verify DNS resolution for api.resend.com',
      'Contact hosting provider about outbound connection restrictions',
      'Verify your Resend API key is valid'
    ]
  ]);
  exit;
}

error_log("Interest form submission - Resend API response length: " . strlen($resendResponse));
error_log("Interest form submission - Resend API response (first 500 chars): " . substr($resendResponse, 0, 500));

$resendJson = json_decode($resendResponse, true);
$jsonError = json_last_error();

if (!$resendJson) {
  $jsonErrorMsg = '';
  switch ($jsonError) {
    case JSON_ERROR_NONE:
      $jsonErrorMsg = 'No errors';
      break;
    case JSON_ERROR_DEPTH:
      $jsonErrorMsg = 'Maximum stack depth exceeded';
      break;
    case JSON_ERROR_STATE_MISMATCH:
      $jsonErrorMsg = 'Underflow or the modes mismatch';
      break;
    case JSON_ERROR_CTRL_CHAR:
      $jsonErrorMsg = 'Unexpected control character found';
      break;
    case JSON_ERROR_SYNTAX:
      $jsonErrorMsg = 'Syntax error, malformed JSON';
      break;
    case JSON_ERROR_UTF8:
      $jsonErrorMsg = 'Malformed UTF-8 characters, possibly incorrectly encoded';
      break;
    default:
      $jsonErrorMsg = 'Unknown error';
      break;
  }
  
  error_log("Interest form submission - JSON decode error: $jsonErrorMsg (code: $jsonError)");
  http_response_code(502);
  echo json_encode([
    'error' => 'resend_invalid_response', 
    'details' => "JSON decode failed: $jsonErrorMsg",
    'json_error_code' => $jsonError,
    'raw_response' => substr($resendResponse, 0, 500),
    'response_length' => strlen($resendResponse)
  ]);
  exit;
}

// Check for Resend API errors
if (isset($resendJson['message']) && !isset($resendJson['id'])) {
  error_log("Interest form submission - Resend API error: " . json_encode($resendJson));
  http_response_code(502);
  echo json_encode([
    'error' => 'resend_api_error',
    'details' => $resendJson['message'] ?? 'Unknown error',
    'resend_response' => $resendJson
  ]);
  exit;
}

// Success case - Resend returns an 'id' field for successful emails
if (isset($resendJson['id'])) {
  error_log("Interest form submission - Successfully submitted to Resend, ID: " . $resendJson['id']);
  echo json_encode([
    'ok' => true,
    'message' => 'Form submitted successfully',
    'email_id' => $resendJson['id']
  ]);
  exit;
}

// Fallback error case
error_log("Interest form submission - Unexpected Resend response: " . json_encode($resendJson));
http_response_code(502);
echo json_encode([
  'error' => 'resend_unexpected_response',
  'details' => 'Resend API returned an unexpected response format',
  'resend_response' => $resendJson
]);
