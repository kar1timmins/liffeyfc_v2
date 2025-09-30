echo "<h2>🌐 Connectivity Tests</h2>";

// Test reCAPTCHA API connectivity
echo "<h3>reCAPTCHA API Test</h3>";
$testUrl = 'https://www.google.com/recaptcha/api/siteverify';
echo "<p>Testing connection to: <code>$testUrl</code></p>";

if (function_exists('curl_init')) {
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => $testUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => 'secret=test&response=test',
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    
    $response = curl_exec($curl);
    $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    
    if ($response !== false && empty($error)) {
        echo "<p>✅ cURL to reCAPTCHA API: SUCCESS (HTTP $httpCode)</p>";
    } else {
        echo "<p>❌ cURL to reCAPTCHA API: FAILED - $error</p>";
    }
} else {
    echo "<p>⚠️ cURL not available</p>";
}

if (ini_get('allow_url_fopen')) {
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'content' => 'secret=test&response=test',
            'timeout' => 10
        ]
    ]);
    $response = @file_get_contents($testUrl, false, $context);
    if ($response !== false) {
        echo "<p>✅ file_get_contents to reCAPTCHA API: SUCCESS</p>";
    } else {
        echo "<p>❌ file_get_contents to reCAPTCHA API: FAILED</p>";
    }
} else {
    echo "<p>⚠️ allow_url_fopen disabled</p>";
}

// Test Web3Forms API connectivity
echo "<h3>Web3Forms API Test</h3>";
$web3formsUrl = 'https://api.web3forms.com/submit';
echo "<p>Testing connection to: <code>$web3formsUrl</code></p>";

if (function_exists('curl_init')) {
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => $web3formsUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['access_key' => 'test']),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    
    $response = curl_exec($curl);
    $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    
    if ($response !== false && empty($error)) {
        echo "<p>✅ cURL to Web3Forms API: SUCCESS (HTTP $httpCode)</p>";
    } else {
        echo "<p>❌ cURL to Web3Forms API: FAILED - $error</p>";
    }
} else {
    echo "<p>⚠️ cURL not available</p>";
}

if (ini_get('allow_url_fopen')) {
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => json_encode(['access_key' => 'test']),
            'timeout' => 10
        ]
    ]);
    $response = @file_get_contents($web3formsUrl, false, $context);
    if ($response !== false) {
        echo "<p>✅ file_get_contents to Web3Forms API: SUCCESS</p>";
    } else {
        echo "<p>❌ file_get_contents to Web3Forms API: FAILED</p>";
    }
} else {
    echo "<p>⚠️ allow_url_fopen disabled</p>";
}