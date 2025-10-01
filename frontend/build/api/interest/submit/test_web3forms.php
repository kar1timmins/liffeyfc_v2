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
            'Accept: application/json',
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language: en-US,en;q=0.9',
            'Accept-Encoding: gzip, deflate, br',
            'Cache-Control: no-cache',
            'Pragma: no-cache',
            'Origin: https://liffeyfoundersclub.com',
            'Referer: https://liffeyfoundersclub.com/'
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_ENCODING => ''
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
    
    // Check for Cloudflare challenge
    if (stripos($response, 'Just a moment') !== false || stripos($response, 'cloudflare') !== false) {
        echo "<p style='color: orange;'><strong>⚠️ CLOUDFLARE CHALLENGE DETECTED</strong></p>";
        echo "<p>The request was blocked by Cloudflare's bot protection. This means:</p>";
        echo "<ul>";
        echo "<li>The server's User-Agent or request headers look suspicious to Cloudflare</li>";
        echo "<li>Your server's IP might be flagged or rate-limited</li>";
        echo "<li>Web3Forms is using Cloudflare protection that blocks automated requests</li>";
        echo "</ul>";
        echo "<p><strong>Solutions:</strong></p>";
        echo "<ul>";
        echo "<li>Contact your hosting provider about whitelisting your server for outbound requests</li>";
        echo "<li>Try using form submission from a browser instead of server-side</li>";
        echo "<li>Consider alternative email services that don't use Cloudflare protection</li>";
        echo "</ul>";
    }
    
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