<?php
/**
 * Wayfinder Japan - API Proxy for Demo Deployment
 *
 * This PHP script acts as a secure backend proxy to protect your Gemini API key.
 * It receives requests from the frontend and forwards them to your Node.js backend
 * (which could be running locally or on a different server).
 *
 * For demo purposes with limited API credits:
 * - Set rate limiting to prevent abuse
 * - Add simple request validation
 * - Keep the API key server-side only
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Rate limiting: Simple file-based approach
// For production, use Redis or a database
$rateLimitFile = sys_get_temp_dir() . '/wayfinder_rate_limit.json';
$maxRequestsPerHour = 10; // Limit to 10 requests per hour for demo
$clientIp = $_SERVER['REMOTE_ADDR'];

// Check rate limit
if (file_exists($rateLimitFile)) {
    $rateLimitData = json_decode(file_get_contents($rateLimitFile), true);
    $currentTime = time();

    // Clean old entries (older than 1 hour)
    $rateLimitData = array_filter($rateLimitData, function($timestamp) use ($currentTime) {
        return ($currentTime - $timestamp) < 3600;
    });

    // Check if this IP exceeded the limit
    if (isset($rateLimitData[$clientIp])) {
        $requests = array_filter($rateLimitData[$clientIp], function($timestamp) use ($currentTime) {
            return ($currentTime - $timestamp) < 3600;
        });

        if (count($requests) >= $maxRequestsPerHour) {
            http_response_code(429);
            echo json_encode([
                'error' => 'Rate limit exceeded',
                'message' => 'Too many requests. Please try again later. Demo limit: ' . $maxRequestsPerHour . ' requests per hour.'
            ]);
            exit;
        }
    }
} else {
    $rateLimitData = [];
}

// Read and validate input
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// Basic validation
$requiredFields = ['mode', 'start', 'end', 'arrival_airport', 'departure_airport'];
foreach ($requiredFields as $field) {
    if (!isset($data[$field]) || empty($data[$field])) {
        http_response_code(400);
        echo json_encode(['error' => "Missing required field: $field"]);
        exit;
    }
}

// ============================================================
// CONFIGURATION: Update these for your deployment
// ============================================================

// Option 1: If you're running the Node.js server locally or on a VPS
// Uncomment and set the correct URL
// $BACKEND_URL = 'http://localhost:3000/api/generate';
// $BACKEND_URL = 'https://your-vps-domain.com:3000/api/generate';

// Option 2: For demo without a backend server (static hosting only)
// Return a demo/sample response directly from this file
$USE_STATIC_DEMO = true;

// ============================================================

if ($USE_STATIC_DEMO) {
    // Return a pre-generated demo response
    // This allows the frontend to work without a running Node.js backend
    $demoResponse = json_decode(file_get_contents(__DIR__ . '/../data/demo_response.json'), true);

    if ($demoResponse === null) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Demo data not available',
            'message' => 'Please configure the backend or add demo_response.json'
        ]);
        exit;
    }

    // Record this request for rate limiting
    if (!isset($rateLimitData[$clientIp])) {
        $rateLimitData[$clientIp] = [];
    }
    $rateLimitData[$clientIp][] = time();
    file_put_contents($rateLimitFile, json_encode($rateLimitData));

    // Return demo response
    echo json_encode($demoResponse);
    exit;
}

// Option 1: Forward to Node.js backend
// This requires a running Node.js server (locally or on VPS)

if (!isset($BACKEND_URL)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Backend not configured',
        'message' => 'Please configure BACKEND_URL in generate.php or enable USE_STATIC_DEMO'
    ]);
    exit;
}

// Forward request to Node.js backend
$ch = curl_init($BACKEND_URL);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Content-Length: ' . strlen($input)
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 60); // 60 second timeout

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Backend connection failed',
        'message' => 'Could not connect to the backend server'
    ]);
    exit;
}

// Record this request for rate limiting
if (!isset($rateLimitData[$clientIp])) {
    $rateLimitData[$clientIp] = [];
}
$rateLimitData[$clientIp][] = time();
file_put_contents($rateLimitFile, json_encode($rateLimitData));

// Return backend response
http_response_code($httpCode);
echo $response;
