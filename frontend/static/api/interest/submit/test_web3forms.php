<?php
// Simple Web3Forms test script
// Use this to test your Web3Forms access key independently

header('Content-Type: application/json; charset=utf-8');

$accessKey = getenv('WEB3FORMS_ACCESS_KEY') ?: $_SERVER['WEB3FORMS_ACCESS_KEY'] ?? 'your-key-here';

if ($accessKey === 'your-key-here') {
    echo json_encode([
        'error' => 'Please set WEB3FORMS_ACCESS_KEY in your .htaccess file'
    ]);
    exit;
}

echo "<h1>Web3Forms Test</h1>";
echo "<p>Testing access key: " . substr($accessKey, 0, 8) . "...</p>";

// Simple test payload
$testPayload = [
    'access_key' => $accessKey,
    'to' => 'info@liffeyfoundersclub.com',
    'subject' => 'Test Email from Web3Forms',
    'from_name' => 'Test User',
    'from_email' => 'test@example.com',
    'message' => 'This is a test message to verify Web3Forms integration.'
];

echo "<h2>Test Payload:</h2>";
echo "<pre>" . json_encode($testPayload, JSON_PRETTY_PRINT) . "</pre>";

if (function_exists('curl_init')) {
    echo "<h2>Testing with cURL:</h2>";
    
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => 'https://api.web3forms.com/submit',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($testPayload),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json'
        ],
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    
    $response = curl_exec($curl);
    $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    
    echo "<p><strong>HTTP Code:</strong> $httpCode</p>";
    if ($error) {
        echo "<p><strong>cURL Error:</strong> $error</p>";
    }
    
    echo "<h3>Raw Response:</h3>";
    echo "<pre>" . htmlspecialchars($response) . "</pre>";
    
    $jsonResponse = json_decode($response, true);
    if ($jsonResponse) {
        echo "<h3>Parsed JSON:</h3>";
        echo "<pre>" . json_encode($jsonResponse, JSON_PRETTY_PRINT) . "</pre>";
        
        if (!empty($jsonResponse['success'])) {
            echo "<p style='color: green;'><strong>✅ SUCCESS: Web3Forms test passed!</strong></p>";
        } else {
            echo "<p style='color: red;'><strong>❌ FAILED: " . ($jsonResponse['message'] ?? 'Unknown error') . "</strong></p>";
        }
    } else {
        echo "<p style='color: red;'><strong>❌ FAILED: Invalid JSON response</strong></p>";
        echo "<p><strong>JSON Error:</strong> " . json_last_error_msg() . "</p>";
    }
} else {
    echo "<p style='color: orange;'>⚠️ cURL not available</p>";
}
?>