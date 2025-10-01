<?php
// Quick Web3Forms key comparison test
header('Content-Type: text/html; charset=utf-8');

echo "<h1>Web3Forms Key Comparison Test</h1>";
echo "<p>This will help you test both of your Web3Forms access keys to see which one works.</p>";

// Get the current key from environment
$currentKey = getenv('WEB3FORMS_ACCESS_KEY') ?: $_SERVER['WEB3FORMS_ACCESS_KEY'] ?? 'not-set';

echo "<h2>🔑 Current Configuration</h2>";
echo "<p><strong>Key in .htaccess:</strong> " . substr($currentKey, 0, 8) . "..." . substr($currentKey, -4) . "</p>";

function testWeb3FormsKey($accessKey, $keyName) {
    echo "<h3>Testing: $keyName</h3>";
    echo "<p><strong>Key:</strong> " . substr($accessKey, 0, 8) . "..." . substr($accessKey, -4) . "</p>";
    
    // Minimal test payload
    $testPayload = [
        'access_key' => $accessKey,
        'name' => 'Test User',
        'email' => 'test@example.com',
        'message' => "Test message for key validation - $keyName"
    ];
    
    if (function_exists('curl_init')) {
        $curl = curl_init();
        curl_setopt_array($curl, [
            CURLOPT_URL => 'https://api.web3forms.com/submit',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($testPayload),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'User-Agent: Mozilla/5.0 (compatible; KeyTest/1.0)'
            ],
            CURLOPT_SSL_VERIFYPEER => true
        ]);
        
        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        
        echo "<p><strong>HTTP Status:</strong> $httpCode</p>";
        
        if ($error) {
            echo "<p style='color: red;'><strong>cURL Error:</strong> $error</p>";
            return false;
        }
        
        $jsonResponse = json_decode($response, true);
        
        if ($httpCode == 200 && $jsonResponse && !empty($jsonResponse['success'])) {
            echo "<p style='color: green; font-weight: bold;'>✅ SUCCESS: This key works!</p>";
            echo "<p><strong>Response:</strong> " . ($jsonResponse['message'] ?? 'Email sent successfully') . "</p>";
            return true;
        } elseif ($httpCode == 403) {
            echo "<p style='color: red; font-weight: bold;'>❌ ACCESS DENIED (403): Invalid/expired key</p>";
            if ($jsonResponse && isset($jsonResponse['message'])) {
                echo "<p><strong>Error:</strong> " . htmlspecialchars($jsonResponse['message']) . "</p>";
            }
            return false;
        } elseif ($httpCode == 429) {
            echo "<p style='color: orange; font-weight: bold;'>⚠️ RATE LIMITED (429): Too many requests</p>";
            return 'rate_limited';
        } else {
            echo "<p style='color: red;'><strong>ERROR: HTTP $httpCode</strong></p>";
            if ($jsonResponse && isset($jsonResponse['message'])) {
                echo "<p><strong>Message:</strong> " . htmlspecialchars($jsonResponse['message']) . "</p>";
            }
            echo "<p><strong>Raw Response:</strong></p>";
            echo "<pre>" . htmlspecialchars(substr($response, 0, 500)) . "</pre>";
            return false;
        }
    } else {
        echo "<p style='color: red;'>❌ cURL not available</p>";
        return false;
    }
}

echo "<h2>🧪 Key Testing</h2>";

// Test current key
$result1 = testWeb3FormsKey($currentKey, "Current Key (from .htaccess)");

echo "<hr>";

// You can manually test your other key here
echo "<h3>Manual Test for Second Key</h3>";
echo "<p>To test your other Web3Forms key, replace the key below and refresh this page:</p>";
echo "<form method='post'>";
echo "<label>Enter your second Web3Forms access key:</label><br>";
echo "<input type='text' name='test_key' value='" . ($_POST['test_key'] ?? '') . "' style='width: 400px; padding: 5px;' placeholder='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'><br><br>";
echo "<input type='submit' value='Test Second Key' style='padding: 10px 20px; background: #007cba; color: white; border: none; cursor: pointer;'>";
echo "</form>";

if (!empty($_POST['test_key'])) {
    $secondKey = trim($_POST['test_key']);
    if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $secondKey)) {
        echo "<hr>";
        $result2 = testWeb3FormsKey($secondKey, "Second Key (manual test)");
        
        if ($result2 === true) {
            echo "<div style='background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 10px 0; border-radius: 5px;'>";
            echo "<h4>✅ Your second key works! Update your .htaccess file:</h4>";
            echo "<p>Replace the current key in your .htaccess file with:</p>";
            echo "<code>SetEnv WEB3FORMS_ACCESS_KEY \"$secondKey\"</code>";
            echo "</div>";
        }
    } else {
        echo "<p style='color: red;'>❌ Invalid key format. Please enter a valid UUID.</p>";
    }
}

echo "<h2>📋 Summary</h2>";
echo "<ul>";
echo "<li>Having multiple keys for one email is perfectly normal</li>";
echo "<li>Each key can have different settings (domain restrictions, quotas, etc.)</li>";
echo "<li>Keys can be deactivated, expired, or have quota limits</li>";
echo "<li>Always test keys before deploying to production</li>";
echo "</ul>";

echo "<p><em>Test completed at " . date('Y-m-d H:i:s T') . "</em></p>";
?>