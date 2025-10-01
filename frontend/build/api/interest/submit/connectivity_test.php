<?php
// Network connectivity test for Web3Forms
header('Content-Type: text/html; charset=utf-8');

echo "<h1>Web3Forms Connectivity Test</h1>";
echo "<p>Testing network connectivity to Web3Forms API from this server...</p>";

echo "<h2>🔧 Server Configuration</h2>";
echo "<ul>";
echo "<li><strong>PHP Version:</strong> " . PHP_VERSION . "</li>";
echo "<li><strong>cURL Available:</strong> " . (function_exists('curl_init') ? '✅ Yes' : '❌ No') . "</li>";
echo "<li><strong>OpenSSL Loaded:</strong> " . (extension_loaded('openssl') ? '✅ Yes' : '❌ No') . "</li>";
echo "<li><strong>allow_url_fopen:</strong> " . (ini_get('allow_url_fopen') ? '✅ Enabled' : '❌ Disabled') . "</li>";
echo "<li><strong>User Agent:</strong> " . (ini_get('user_agent') ?: 'Not set') . "</li>";
echo "<li><strong>Server Time:</strong> " . date('Y-m-d H:i:s T') . "</li>";
echo "</ul>";

echo "<h2>🌐 DNS Resolution Test</h2>";
$host = 'api.web3forms.com';
$ip = gethostbyname($host);
if ($ip !== $host) {
    echo "<p>✅ DNS Resolution: <code>$host</code> → <code>$ip</code></p>";
} else {
    echo "<p>❌ DNS Resolution: Failed to resolve <code>$host</code></p>";
}

echo "<h2>🔗 Basic Connectivity Tests</h2>";

// Test 1: Simple HEAD request with cURL
if (function_exists('curl_init')) {
    echo "<h3>Test 1: cURL HEAD Request</h3>";
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => 'https://api.web3forms.com',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_NOBODY => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; ConnectivityTest/1.0)'
    ]);
    
    $result = curl_exec($curl);
    $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    $info = curl_getinfo($curl);
    curl_close($curl);
    
    if ($result !== false && empty($error)) {
        echo "<p>✅ cURL HEAD Request: SUCCESS (HTTP $httpCode)</p>";
        echo "<p><strong>Response Time:</strong> " . round($info['total_time'], 2) . " seconds</p>";
    } else {
        echo "<p>❌ cURL HEAD Request: FAILED</p>";
        echo "<p><strong>Error:</strong> $error</p>";
        echo "<p><strong>HTTP Code:</strong> $httpCode</p>";
    }
}

// Test 2: Simple GET request
if (function_exists('curl_init')) {
    echo "<h3>Test 2: cURL GET Request</h3>";
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => 'https://api.web3forms.com',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; ConnectivityTest/1.0)'
    ]);
    
    $result = curl_exec($curl);
    $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    
    if ($result !== false && empty($error)) {
        echo "<p>✅ cURL GET Request: SUCCESS (HTTP $httpCode)</p>";
        echo "<p><strong>Response Preview:</strong> " . htmlspecialchars(substr($result, 0, 200)) . "...</p>";
    } else {
        echo "<p>❌ cURL GET Request: FAILED</p>";
        echo "<p><strong>Error:</strong> $error</p>";
    }
}

// Test 3: file_get_contents test
if (ini_get('allow_url_fopen')) {
    echo "<h3>Test 3: file_get_contents Test</h3>";
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 15,
            'user_agent' => 'Mozilla/5.0 (compatible; ConnectivityTest/1.0)',
            'follow_location' => 1
        ]
    ]);
    
    $result = @file_get_contents('https://api.web3forms.com', false, $context);
    if ($result !== false) {
        echo "<p>✅ file_get_contents: SUCCESS</p>";
        echo "<p><strong>Response Preview:</strong> " . htmlspecialchars(substr($result, 0, 200)) . "...</p>";
    } else {
        $error = error_get_last();
        echo "<p>❌ file_get_contents: FAILED</p>";
        echo "<p><strong>Error:</strong> " . ($error['message'] ?? 'Unknown error') . "</p>";
    }
} else {
    echo "<h3>Test 3: file_get_contents Test</h3>";
    echo "<p>⚠️ file_get_contents: Disabled (allow_url_fopen = Off)</p>";
}

echo "<h2>📋 Recommendations</h2>";
echo "<ul>";
echo "<li>If all tests fail, contact your hosting provider about outbound HTTPS connectivity</li>";
echo "<li>Check if your server's IP is blocked by Cloudflare or Web3Forms</li>";
echo "<li>Verify firewall settings allow connections to port 443 (HTTPS)</li>";
echo "<li>Consider testing from a different server or network</li>";
echo "<li>Try alternative email services if connectivity issues persist</li>";
echo "</ul>";

echo "<p><em>Test completed at " . date('Y-m-d H:i:s T') . "</em></p>";
?>