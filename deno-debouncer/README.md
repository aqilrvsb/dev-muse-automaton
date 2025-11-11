# Deno Deploy Message Debouncer

A lightweight message debouncing service deployed on Deno Deploy that prevents multiple rapid messages from triggering multiple AI responses.

## How It Works

```
Customer sends message 1 → Queue created, timer starts (30s)
Customer sends message 2 → Added to queue, timer RESETS (30s)
Customer sends message 3 → Added to queue, timer RESETS (30s)
[30 seconds of silence]
Timer expires → All 3 messages sent to Go backend
Go backend → Gets device config, processes with AI, sends ONE response
```

## Architecture

```
WhatsApp Customer
    ↓
Webhook (WhatsApp Provider)
    ↓
Deno Deploy (this service)
    ├─ Queues messages in Deno KV
    ├─ 30-second debouncing timer
    └─ After 30s silence → Sends combined messages
        ↓
Go Backend (/api/debounce/process)
    ├─ Gets device configuration from database
    ├─ Gets AI provider settings (OpenAI/Anthropic)
    ├─ Processes messages with AI
    ├─ Tracks conversation history
    └─ Sends response via WhatsApp (WaHa/WhaCenter)
```

## Setup

### 1. Deploy to Deno Deploy

```bash
# Install Deno Deploy CLI
deno install --allow-all --name deployctl jsr:@deno/deployctl

# Login to Deno Deploy
deployctl login

# Deploy the service
cd deno-debouncer
deployctl deploy --project=your-project-name main.ts
```

### 2. Set Environment Variables

In your Deno Deploy dashboard (https://dash.deno.com):

```
GO_BACKEND_URL=https://chatbot-automation-production.up.railway.app
```

### 3. Update WhatsApp Webhook

Update your WhatsApp provider webhook to point to your Deno Deploy URL:

```
https://your-project-name.deno.dev/webhook
```

## API Endpoints

### POST /webhook

Receives incoming WhatsApp messages for debouncing.

**Request Body:**
```json
{
  "phone": "60123456789",
  "deviceId": "device-uuid-here",
  "message": "Hello, I have a question",
  "name": "Customer Name"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message queued for debouncing"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "deno-message-debouncer",
  "debounceDelay": "30000ms",
  "goBackend": "https://chatbot-automation-production.up.railway.app"
}
```

## Features

- **30-Second Debouncing**: Multiple messages within 30 seconds are combined into one
- **Timer Reset**: Each new message resets the 30-second timer
- **Deno KV Storage**: Fast, distributed key-value storage for message queues
- **Automatic Cleanup**: Old/stuck queues are automatically cleaned every 10 minutes
- **Device-specific Queues**: Messages are queued per device + phone number
- **Zero AI Dependencies**: All AI processing handled by Go backend (uses your existing device configs)

## Local Development

```bash
# Run locally
cd deno-debouncer
deno run --allow-net --allow-env --unstable-kv main.ts

# Test the webhook
curl -X POST http://localhost:8000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "60123456789",
    "deviceId": "test-device",
    "message": "Test message 1",
    "name": "Test User"
  }'

# Send multiple messages quickly
curl -X POST http://localhost:8000/webhook -H "Content-Type: application/json" -d '{"phone":"60123456789","deviceId":"test-device","message":"Message 1"}'
sleep 5
curl -X POST http://localhost:8000/webhook -H "Content-Type: application/json" -d '{"phone":"60123456789","deviceId":"test-device","message":"Message 2"}'
sleep 5
curl -X POST http://localhost:8000/webhook -H "Content-Type: application/json" -d '{"phone":"60123456789","deviceId":"test-device","message":"Message 3"}'

# Wait 30 seconds and check logs - should see ONE combined request to Go backend
```

## Logs

The service logs all activities:

- `🆕` New queue created
- `📩` Message added to existing queue
- `⏰` Timer expired, processing messages
- `📤` Sending to Go backend
- `✅` Successfully processed
- `🗑️` Queue cleared
- `🧹` Old queue cleaned up
- `❌` Error occurred

## Go Backend Integration

The Go backend must have this endpoint:

**POST /api/debounce/process**

Request:
```json
{
  "device_id": "device-uuid",
  "phone": "60123456789",
  "name": "Customer Name",
  "messages": [
    "Message 1",
    "Message 2",
    "Message 3"
  ]
}
```

Response:
```json
{
  "success": true,
  "message": "Messages processed and response sent"
}
```

## Benefits

1. **No Duplicate Responses**: Customers get ONE response, not multiple
2. **Better Context**: AI sees all messages at once, not fragmented
3. **Cost Savings**: Fewer AI API calls
4. **Improved UX**: More coherent, context-aware responses
5. **Simple Setup**: Just one environment variable
6. **Uses Existing Config**: All device settings, AI configs, and WhatsApp providers from your database

## Troubleshooting

### Messages not being debounced?

Check the logs in Deno Deploy dashboard. Make sure:
- Webhook is configured correctly
- GO_BACKEND_URL is set correctly
- Messages have required fields: phone, deviceId, message

### Timer not working?

Deno Deploy uses isolates that may restart. The timer uses `setTimeout` which persists during the isolate lifecycle. For production, consider using Deno Cron for more reliability.

### Go backend not receiving messages?

Test the Go backend endpoint directly:
```bash
curl -X POST https://your-backend.com/api/debounce/process \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "test",
    "phone": "60123456789",
    "name": "Test",
    "messages": ["Hello"]
  }'
```
