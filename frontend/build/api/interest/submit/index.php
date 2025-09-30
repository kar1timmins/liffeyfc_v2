<?php
// Lightweight PHP relay for form submissions when deployed on Blacknight (Apache)
// Expects JSON body and environment variables in server config (.htaccess SetEnv or control panel):
//   RECAPTCHA_SECRET_KEY
//   WEB3FORMS_ACCESS_KEY (preferred) or WEB_ACCESS_KEY (legacy)
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

$accessKey = getenv('WEB3FORMS_ACCESS_KEY') ?: getenv('WEB_ACCESS_KEY') ?: $_ENV['WEB3FORMS_ACCESS_KEY'] ?? $_ENV['WEB_ACCESS_KEY'] ?? $_SERVER['WEB3FORMS_ACCESS_KEY'] ?? $_SERVER['WEB_ACCESS_KEY'] ?? null;
if (!$accessKey) {
  error_log("Interest form submission - Missing WEB3FORMS_ACCESS_KEY in environment");
  http_response_code(500);
  echo json_encode(['error' => 'missing_web3forms_key']);
  exit;
}

$payload = [
  'access_key' => $accessKey,
  'to' => 'info@liffeyfoundersclub.com',
  'subject' => 'New Interest Form Submission from ' . $name,
  'from_name' => $name,
  'from_email' => $email,
  'name' => $name,
  'email' => $email,
  'pitchedBefore' => $pitchedBefore,
  'interest' => $interest,
  'message' => $message,
  'event_year' => $event_year,
  'event_quarter' => $event_quarter,
  'consent' => $consent
];

error_log("Interest form submission - Submitting to Web3Forms with access key: " . substr($accessKey, 0, 8) . "...");

// Try cURL first for Web3Forms submission
$web3formsResponse = false;
if (function_exists('curl_init')) {
  $curl = curl_init();
  curl_setopt_array($curl, [
    CURLOPT_URL => 'https://api.web3forms.com/submit',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_HTTPHEADER => [
      'Content-Type: application/json',
      'Accept: application/json',
      'User-Agent: LiffeyFC-ContactForm/1.0'
    ],
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2
  ]);
  
  $web3formsResponse = curl_exec($curl);
  $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
  $curlError = curl_error($curl);
  curl_close($curl);
  
  if ($web3formsResponse === false || !empty($curlError)) {
    error_log("Interest form submission - cURL failed for Web3Forms: " . $curlError);
    $web3formsResponse = false;
  } else {
    error_log("Interest form submission - Web3Forms cURL success, HTTP code: " . $httpCode);
  }
}

// Fallback to file_get_contents if cURL failed
if ($web3formsResponse === false && ini_get('allow_url_fopen')) {
  error_log("Interest form submission - Trying file_get_contents fallback for Web3Forms");
  $web3formsContext = stream_context_create([
    'http' => [
      'method' => 'POST',
      'header' => "Content-Type: application/json\r\nAccept: application/json\r\nUser-Agent: LiffeyFC-ContactForm/1.0\r\n",
      'content' => json_encode($payload),
      'timeout' => 30
    ]
  ]);
  
  $web3formsResponse = file_get_contents('https://api.web3forms.com/submit', false, $web3formsContext);
  if ($web3formsResponse === false) {
    error_log("Interest form submission - file_get_contents also failed for Web3Forms");
  }
}

if ($web3formsResponse === false) {
  error_log("Interest form submission - All methods failed to contact Web3Forms API");
  http_response_code(502);
  echo json_encode([
    'error' => 'web3forms_api_unreachable',
    'details' => 'Server cannot reach Web3Forms API. Please contact administrator.',
    'curl_available' => function_exists('curl_init'),
    'url_fopen_enabled' => ini_get('allow_url_fopen')
  ]);
  exit;
}

error_log("Interest form submission - Web3Forms API response: " . $web3formsResponse);

$web3formsJson = json_decode($web3formsResponse, true);
if (!$web3formsJson) {
  error_log("Interest form submission - Invalid JSON response from Web3Forms API");
  http_response_code(502);
  echo json_encode([
    'error' => 'web3forms_invalid_response', 
    'raw_response' => substr($web3formsResponse, 0, 500) // Limit response length
  ]);
  exit;
}

if (empty($web3formsJson['success'])) {
  error_log("Interest form submission - Web3Forms submission failed: " . json_encode($web3formsJson));
  http_response_code(502);
  echo json_encode([
    'error' => 'web3forms_submission_failed',
    'details' => $web3formsJson['message'] ?? 'Unknown error',
    'web3forms_response' => $web3formsJson
  ]);
  exit;
}

error_log("Interest form submission - Successfully submitted to Web3Forms");
echo json_encode([
  'ok' => true,
  'message' => 'Form submitted successfully',
  'web3forms_id' => $web3formsJson['id'] ?? null
]);
