# Webhook Integration with Deno Deploy - COMPLETE ✅

## Summary

Your webhook URL now has **full Deno Deploy integration** with automatic data extraction for both Whacenter and Waha providers.

## Your Webhook URL

```
https://chatbot-automation-production.up.railway.app/FakhriAidilTLW-002/c4f03b0c-bc86-4ffd-a837-0caf32e890db
```

**Format:** `/{webhook_id}/{flow_name}` or `/{device_id}/{flow_id}`

## Complete Flow with Deno Integration

```
User sends WhatsApp message: "Hello"
    ↓
WhatsApp Provider (Whacenter/Waha) → Your Railway Webhook
    ↓
Step 1: ReceiveWebhook Handler (webhook_handler.go:452)
    ↓
Step 2: Get Device by webhook_id or device_id
    ↓
Step 3: Detect Provider
    - Auto-detect Waha (has "payload" + "session" fields)
    - Default to Whacenter
    ↓
Step 4: Extract Message Data
    - Uses WebhookService.ExtractMessageData()
    - Handles Whacenter format: {message, from, phone, pushName}
    - Handles Waha format: {payload: {body, from}, session}
    - Extracts: phone, message, name, device_id
    ↓
Step 5: Forward to Deno Deploy
    - POST to: https://chatbot-debouncer.deno.dev/queue
    - Payload: {device_id, phone, message, name}
    ↓
Deno Deploy: Queue message, start 8-second timer
    ↓
User sends: "How are you?" (within 8 seconds)
    ↓ Forwarded to Deno → Timer resets to 8 seconds
    ↓
User sends: "Are you there?" (within 8 seconds)
    ↓ Forwarded to Deno → Timer resets to 8 seconds
    ↓
[8 seconds pass with no new messages]
    ↓
Deno Deploy: Combines all messages
    - Sets: isProcessing = true (blocks new messages)
    - Combines: ["Hello", "How are you?", "Are you there?"]
    - Sends to: /api/debounce/process
    ↓
Backend: HandleDebouncedMessages (webhook_handler.go:357)
    - Processes combined messages with AI
    - Sends single reply via WhatsApp
    ↓
Deno Deploy: Cleanup
    - Sets: isProcessing = false
    - Sets: lastProcessedAt = now
    - Starts: 30-second cooldown
    ↓
User sends: "Thanks" (immediately after reply)
    ↓ Deno IGNORES (reason: processing/cooldown)
    ↓ Prevents duplicate reply ✅
    ↓
After 30 seconds: Session cleaned up, ready for new messages
```

## Data Extraction - Handles Both Providers

### Whacenter Webhook Format
```json
{
  "message": "Hello",
  "from": "60123456789",
  "phone": "60123456789",
  "pushName": "John",
  "isGroup": false
}
```

**Extraction:**
- Phone: `from` field (or `phone` if `from` is empty)
- Message: `message` field
- Name: `pushName` field (default: "Sis")
- Device ID: From device lookup

### Waha Webhook Format
```json
{
  "event": "message",
  "session": "default",
  "payload": {
    "body": "Hello",
    "from": "60123456789@c.us",
    "_data": {
      "Info": {
        "PushName": "John"
      }
    }
  }
}
```

**Extraction:**
- Phone: `payload.from` (strips @c.us suffix)
- Message: `payload.body`
- Name: `payload._data.Info.PushName` (default: "Sis")
- Device ID: From device lookup

## Fallback System

If any step fails, the system falls back to **direct processing without Deno**:

1. **Device not found** → Direct processing (no Deno)
2. **Extraction fails** → Direct processing (no Deno)
3. **Deno unavailable** → Direct processing (no Deno)

This ensures your bot **always works**, even if Deno Deploy has issues.

## Key Features

### 1. Automatic Provider Detection ✅
```go
// Auto-detect Waha
if _, hasPayload := webhookData["payload"]; hasPayload {
    if _, hasSession := webhookData["session"]; hasSession {
        provider = "waha"
    }
}
// Default to Whacenter
if provider == "" {
    provider = "whacenter"
}
```

### 2. Proper Data Extraction ✅
Uses `WebhookService.ExtractMessageData()` which:
- Validates phone numbers
- Cleans phone number formats
- Handles different field names
- Skips group messages
- Provides default values

### 3. Deno Integration ✅
Forwards clean, extracted data:
```json
{
  "device_id": "FakhriAidilTLW-002",
  "phone": "60123456789",
  "message": "Hello",
  "name": "John"
}
```

### 4. Duplicate Prevention ✅
- **Processing flag:** Blocks messages while AI is responding
- **Cooldown period:** Blocks messages for 30 seconds after reply
- **Explicit logging:** Shows why messages are ignored

## Logging

### Backend Logs (Railway)

**When message received:**
```
📥 Received webhook for ID: FakhriAidilTLW-002
📦 RAW WEBHOOK BODY: {...}
📦 Webhook data received: 5 fields
🔍 Detected Waha webhook from data structure
✅ Found device: FakhriAidilTLW-002 (Provider: waha)
✅ Extracted message: phone=60123456789, message=Hello, name=John
📮 Forwarded to Deno (queue size: 1): device=FakhriAidilTLW-002, phone=60123456789
```

**When Deno ignores message:**
```
⏭️  Deno ignored message (reason: processing): device=FakhriAidilTLW-002, phone=60123456789
```

**When batch received from Deno:**
```
🔄 [DEBOUNCED] Received 3 messages from 60123456789 (device: FakhriAidilTLW-002)
💬 Combined message: Hello
How are you?
Are you there?
📤 Sent debounced reply to 60123456789: [AI response]
```

### Deno Deploy Logs

**Message queued:**
```json
{
  "timestamp": "2025-10-30T...",
  "level": "info",
  "message": "Message queued",
  "data": {
    "sessionKey": "FakhriAidilTLW-002:60123456789",
    "queueSize": 1,
    "debounceDelay": 8000
  }
}
```

**Message ignored:**
```json
{
  "timestamp": "2025-10-30T...",
  "level": "warn",
  "message": "Session is processing, message ignored to prevent duplicate",
  "data": {
    "sessionKey": "FakhriAidilTLW-002:60123456789",
    "ignoredMessage": "Thanks"
  }
}
```

**Processing batch:**
```json
{
  "timestamp": "2025-10-30T...",
  "level": "info",
  "message": "Sending to backend",
  "data": {
    "sessionKey": "FakhriAidilTLW-002:60123456789",
    "messageCount": 3,
    "backendUrl": "https://chatbot-automation-production.up.railway.app/api/debounce/process"
  }
}
```

## Testing

### Test 1: Single Message

**Send:** "Hello"

**Expected logs:**
1. Backend: `📮 Forwarded to Deno`
2. Deno: `Message queued` (queueSize: 1)
3. [8 seconds wait]
4. Deno: `Sending to backend` (messageCount: 1)
5. Backend: `🔄 [DEBOUNCED] Received 1 messages`
6. Backend: `📤 Sent debounced reply`

### Test 2: Multiple Rapid Messages

**Send rapidly:**
1. "Hello"
2. "How are you?"
3. "Are you there?"

**Expected logs:**
1. Backend: `📮 Forwarded to Deno` (x3)
2. Deno: `Message queued`, `Timer reset` (x3)
3. [8 seconds wait]
4. Deno: `Sending to backend` (messageCount: 3)
5. Backend: `🔄 [DEBOUNCED] Received 3 messages`
6. Backend: `💬 Combined message: Hello\nHow are you?\nAre you there?`
7. Backend: `📤 Sent debounced reply`

### Test 3: Duplicate Prevention

**Steps:**
1. Send: "Test 1"
2. [Wait 8 seconds - gets processed]
3. **Immediately** send: "Test 2" (before cooldown expires)

**Expected logs:**
1. Deno: `Session is processing, message ignored`
2. Backend: `⏭️  Deno ignored message (reason: processing)`
3. [30 seconds pass]
4. Send: "Test 3" (after cooldown)
5. Backend: `📮 Forwarded to Deno` (works normally)

## Monitoring

### Check Deno Deploy Status
```bash
curl https://chatbot-debouncer.deno.dev/status
```

### Check Deno Deploy Health
```bash
curl https://chatbot-debouncer.deno.dev/health
```

### View Backend Logs
Your Railway logs or local console will show all webhook activity.

### View Deno Logs
1. Go to: https://dash.deno.com/projects/chatbot-debouncer
2. Click: **Logs** tab
3. Filter by level: `info`, `warn`, `error`, `success`

## Configuration

### Timing Settings (in deno/debounce.ts)

```typescript
const DEBOUNCE_DELAY = 8000; // 8 seconds
const PROCESSING_COOLDOWN = 30000; // 30 seconds
```

**Adjust if needed:**
- Increase `DEBOUNCE_DELAY` if users send many messages very rapidly
- Increase `PROCESSING_COOLDOWN` if AI takes longer than 30 seconds

### Deno Deploy Environment Variable

Set in Deno Deploy Dashboard:
```
BACKEND_URL = https://chatbot-automation-production.up.railway.app
```

**Do NOT include** `/api/debounce/process` - it's added automatically.

## Files Modified

### Backend

1. **internal/handler/webhook_handler.go**
   - Updated `WebhookHandler` struct (added `webhookService` and `deviceRepo`)
   - Updated `NewWebhookHandler()` constructor
   - Updated `ReceiveWebhook()` handler (lines 452-573)
     - Added device lookup
     - Added provider detection
     - Added data extraction
     - Added Deno forwarding
     - Added fallback handling

2. **cmd/server/main.go**
   - Updated `webhookHandler` initialization (line 71)
   - Added `webhookService` and `deviceRepo` parameters

### Deno Deploy

Already deployed with:
- 8-second debounce delay ✅
- 30-second processing cooldown ✅
- Duplicate prevention ✅
- Health check endpoint ✅
- Status monitoring ✅

## Summary of What Was Done

### Before (Old Flow)
```
Webhook → ReceiveWebhook → FlowProcessor → Direct Processing
```
- No debouncing
- No message combining
- No duplicate prevention
- Multiple separate AI calls

### After (New Flow)
```
Webhook → ReceiveWebhook → Extract Data → Deno Deploy → Debounce → Backend → AI → Reply
```
- ✅ 8-second debouncing
- ✅ Message combining
- ✅ Duplicate prevention (processing flag + cooldown)
- ✅ Single AI call per batch
- ✅ Automatic provider detection
- ✅ Proper data extraction
- ✅ Fallback to direct processing if Deno fails

## Your Duplicate Reply Issue is SOLVED! 🎉

The system now:
1. **Extracts data properly** from both Whacenter and Waha
2. **Forwards to Deno Deploy** for intelligent queuing
3. **Combines rapid messages** into single batch
4. **Prevents duplicates** with processing flags and cooldown
5. **Falls back gracefully** if Deno is unavailable

**Next time a user sends multiple messages, they will receive ONE comprehensive reply, not multiple replies!**
