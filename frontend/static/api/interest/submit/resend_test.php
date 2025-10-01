<?php
// Simple Resend API test
header('Content-Type: application/json; charset=utf-8');

error_log("Resend test - Starting");

// Check if we can access environment variables
$accessKey = getenv('RESEND_API_KEY') ?: $_ENV['RESEND_API_KEY'] ?? $_SERVER['RESEND_API_KEY'] ?? null;

if (!$accessKey) {
    error_log("Resend test - No API key found");
    echo json_encode([
        'error' => 'missing_api_key',
        'details' => 'RESEND_API_KEY not found in environment variables',
        'env_methods' => [
            'getenv' => getenv('RESEND_API_KEY') ?: 'not found',
            '$_ENV' => $_ENV['RESEND_API_KEY'] ?? 'not found',
            '$_SERVER' => $_SERVER['RESEND_API_KEY'] ?? 'not found'
        ]
    ]);
    exit;
}

error_log("Resend test - Found API key: " . substr($accessKey, 0, 8) . "...");

// Validate API key format
if (!preg_match('/^re_[A-Za-z0-9_]+$/', $accessKey)) {
    error_log("Resend test - Invalid key format");
    echo json_encode([
        'error' => 'invalid_key_format',
        'key_preview' => substr($accessKey, 0, 10) . '...'
    ]);
    exit;
}

// Test payload
$payload = [
    'from' => 'onboarding@resend.dev',
    'to' => ['info@liffeyfoundersclub.com'],
    'subject' => 'Test Email from Resend',
    'html' => '<h1>Test Email</h1><p>This is a test email to verify Resend integration.</p>'
];

error_log("Resend test - Attempting to send email");

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
            'Authorization: Bearer ' . $accessKey
        ],
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    
    $response = curl_exec($curl);
    $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    
    error_log("Resend test - HTTP Code: $httpCode");
    error_log("Resend test - Response: " . substr($response, 0, 500));
    
    if ($error) {
        error_log("Resend test - cURL Error: $error");
        echo json_encode([
            'error' => 'curl_error',
            'details' => $error,
            'http_code' => $httpCode
        ]);
        exit;
    }
    
    $responseJson = json_decode($response, true);
    
    echo json_encode([
        'success' => true,
        'http_code' => $httpCode,
        'response' => $responseJson,
        'key_preview' => substr($accessKey, 0, 8) . '...'
    ]);
    
} else {
    error_log("Resend test - cURL not available");
    echo json_encode([
        'error' => 'curl_not_available',
        'details' => 'cURL extension is not available'
    ]);
}
?>