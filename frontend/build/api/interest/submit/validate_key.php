<?php
// Web3Forms Access Key Validation Test
header('Content-Type: text/html; charset=utf-8');

echo "<h1>Web3Forms Access Key Validation</h1>";

$accessKey = getenv('WEB3FORMS_ACCESS_KEY') ?: $_SERVER['WEB3FORMS_ACCESS_KEY'] ?? 'not-set';

echo "<h2>🔑 Access Key Information</h2>";
echo "<p><strong>Access Key:</strong> " . substr($accessKey, 0, 8) . "..." . substr($accessKey, -4) . "</p>";
echo "<p><strong>Format Valid:</strong> " . (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $accessKey) ? '✅ Yes' : '❌ No') . "</p>";

if ($accessKey === 'not-set') {
    echo "<p style='color: red;'><strong>❌ ERROR: WEB3FORMS_ACCESS_KEY not found in environment variables</strong></p>";
    echo "<p>Please set the access key in your .htaccess file or hosting control panel.</p>";
    exit;
}

echo "<h2>🧪 Minimal API Test</h2>";
echo "<p>Testing the access key with a minimal payload...</p>";

// Minimal test payload
$testPayload = [
    'access_key' => $accessKey,
    'name' => 'Test User',
    'email' => 'test@example.com',
    'message' => 'This is a test message to validate the Web3Forms access key.'
];

echo "<h3>Test Payload:</h3>";
echo "<pre>" . json_encode($testPayload, JSON_PRETTY_PRINT) . "</pre>";

if (function_exists('curl_init')) {
    echo "<h3>cURL Test Result:</h3>";
    
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
            'User-Agent: Mozilla/5.0 (compatible; Web3FormsTest/1.0)'
        ],
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    
    $response = curl_exec($curl);
    $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    
    echo "<p><strong>HTTP Status Code:</strong> $httpCode</p>";
    
    if ($error) {
        echo "<p style='color: red;'><strong>cURL Error:</strong> $error</p>";
    }
    
    echo "<h4>Raw Response:</h4>";
    echo "<pre>" . htmlspecialchars($response) . "</pre>";
    
    // Analyze the response
    if ($httpCode == 200) {
        $jsonResponse = json_decode($response, true);
        if ($jsonResponse && !empty($jsonResponse['success'])) {
            echo "<p style='color: green;'><strong>✅ SUCCESS: Access key is valid and working!</strong></p>";
        } else {
            echo "<p style='color: orange;'><strong>⚠️ PARTIAL SUCCESS: Got HTTP 200 but Web3Forms returned an error</strong></p>";
            if ($jsonResponse) {
                echo "<p><strong>Web3Forms Error:</strong> " . ($jsonResponse['message'] ?? 'Unknown error') . "</p>";
            }
        }
    } elseif ($httpCode == 403) {
        echo "<p style='color: red;'><strong>❌ ACCESS DENIED (403): Invalid or expired access key</strong></p>";
        echo "<p><strong>Solutions:</strong></p>";
        echo "<ul>";
        echo "<li>Verify the access key is correct and hasn't been regenerated</li>";
        echo "<li>Check if your Web3Forms account is active and not suspended</li>";
        echo "<li>Ensure you haven't exceeded your quota limits</li>";
        echo "<li>Try creating a new access key in your Web3Forms dashboard</li>";
        echo "</ul>";
    } elseif ($httpCode == 429) {
        echo "<p style='color: orange;'><strong>⚠️ RATE LIMITED (429): Too many requests</strong></p>";
        echo "<p>Wait a few minutes and try again.</p>";
    } else {
        echo "<p style='color: red;'><strong>❌ ERROR: HTTP $httpCode</strong></p>";
        echo "<p>This suggests a server or network issue.</p>";
    }
    
    $jsonResponse = json_decode($response, true);
    if ($jsonResponse) {
        echo "<h4>Parsed JSON Response:</h4>";
        echo "<pre>" . json_encode($jsonResponse, JSON_PRETTY_PRINT) . "</pre>";
    }
} else {
    echo "<p style='color: red;'>❌ cURL not available</p>";
}

echo "<h2>📋 Next Steps</h2>";
echo "<ul>";
echo "<li>If you get a 403 error, your access key is likely invalid or expired</li>";
echo "<li>Check your Web3Forms dashboard at <a href='https://web3forms.com/dashboard' target='_blank'>web3forms.com/dashboard</a></li>";
echo "<li>Verify your account status and quota usage</li>";
echo "<li>Try regenerating your access key if needed</li>";
echo "<li>Contact Web3Forms support if issues persist</li>";
echo "</ul>";

echo "<p><em>Test completed at " . date('Y-m-d H:i:s T') . "</em></p>";
?>