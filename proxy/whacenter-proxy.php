<?php
header('Access-Control-Allow-Origin: *'); // Change to your domain in production
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$apiBase = 'https://app.whacenter.com';
$apiKey = 'abebe840-156c-441c-8252-da0342c5a07c';

// Get the endpoint from the request
$endpoint = $_GET['endpoint'] ?? '';

switch ($endpoint) {
    case 'addDevice':
        $name = $_GET['name'] ?? '';
        $number = $_GET['number'] ?? '';

        $url = "$apiBase/api/addDevice?api_key=" . urlencode($apiKey) .
               "&name=" . urlencode($name) .
               "&number=" . urlencode($number);

        $response = file_get_contents($url);
        echo $response;
        break;

    case 'setWebhook':
        $deviceId = $_GET['device_id'] ?? '';
        $webhook = $_GET['webhook'] ?? '';

        $url = "$apiBase/api/setWebhook?device_id=" . urlencode($deviceId) .
               "&webhook=" . urlencode($webhook);

        $response = file_get_contents($url);
        echo $response;
        break;

    case 'statusDevice':
        $deviceId = $_GET['device_id'] ?? '';

        $url = "$apiBase/api/statusDevice?device_id=" . urlencode($deviceId);

        $response = file_get_contents($url);
        echo $response;
        break;

    case 'qr':
        $deviceId = $_GET['device_id'] ?? '';

        $url = "$apiBase/api/qr?device_id=" . urlencode($deviceId);

        $response = file_get_contents($url);
        echo $response;
        break;

    case 'deleteDevice':
        $deviceId = $_GET['device_id'] ?? '';

        $url = "$apiBase/api/deleteDevice?api_key=" . urlencode($apiKey) .
               "&device_id=" . urlencode($deviceId);

        $response = file_get_contents($url);
        echo $response;
        break;

    default:
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
        break;
}
?>
