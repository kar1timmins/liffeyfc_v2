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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'method_not_allowed']);
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

$recaptchaSecret = getenv('RECAPTCHA_SECRET_KEY');
if (!$recaptchaSecret) {
  http_response_code(500);
  echo json_encode(['error' => 'missing_recaptcha_secret']);
  exit;
}

// Verify reCAPTCHA
$recaptchaResponse = file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, stream_context_create([
  'http' => [
    'method' => 'POST',
    'header' => "Content-type: application/x-www-form-urlencoded\r\n",
    'content' => http_build_query([
      'secret' => $recaptchaSecret,
      'response' => $recaptchaToken
    ])
  ]
]));
$recaptchaJson = json_decode($recaptchaResponse, true);
if (!$recaptchaJson || empty($recaptchaJson['success'])) {
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

$accessKey = getenv('WEB3FORMS_ACCESS_KEY') ?: getenv('WEB_ACCESS_KEY');
if (!$accessKey) {
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

$web3formsContext = stream_context_create([
  'http' => [
    'method' => 'POST',
    'header' => "Content-Type: application/json\r\nAccept: application/json\r\n",
    'content' => json_encode($payload)
  ]
]);

$web3formsResponse = file_get_contents('https://api.web3forms.com/submit', false, $web3formsContext);
if ($web3formsResponse === false) {
  http_response_code(502);
  echo json_encode(['error' => 'web3forms_failed']);
  exit;
}

$web3formsJson = json_decode($web3formsResponse, true);
if (!$web3formsJson || empty($web3formsJson['success'])) {
  http_response_code(502);
  echo json_encode(['error' => 'web3forms_error','detail' => $web3formsJson]);
  exit;
}

echo json_encode(['ok' => true]);
