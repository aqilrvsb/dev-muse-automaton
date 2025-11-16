# Quick Deployment Guide for Deno Deploy

## Current Situation
Your Deno Deploy is running OLD code with:
- ❌ 4-second debounce (old)
- ❌ `/webhook` endpoint (old)
- ❌ No duplicate prevention (old)

You need to update to NEW code with:
- ✅ 8-second debounce
- ✅ `/queue` endpoint
- ✅ Duplicate prevention with processing flags

## Step-by-Step Update

### Step 1: Copy the New Code
1. Open the file `deno/debounce.ts` from this repository
2. Copy ALL the code (line 1 to end)

### Step 2: Replace in Deno Deploy
1. Go to https://dash.deno.com/projects/chatbot-debouncer
2. Click on your project
3. Go to the code editor
4. **DELETE ALL** the old code
5. **PASTE** the new code from `debounce.ts`
6. Click **Save & Deploy**

### Step 3: Update Environment Variables
In Deno Deploy dashboard → Settings → Environment Variables:

```
Variable Name: BACKEND_URL
Value: https://chatbot-automation-production.up.railway.app
```

**Important:** Remove the `/webhook` or `/api/debounce/process` from the URL. The new code adds the endpoint automatically.

### Step 4: Verify Deployment
After deploying, check the logs. You should see:

```
🚀 Deno Deploy Debounce Service Started
⏱️  Debounce delay: 8000ms (8 seconds)  ← Should be 8000, not 4000
🔗 Go backend: https://chatbot-automation-production.up.railway.app
📝 Processing cooldown: 30000ms (30 seconds)  ← New feature
```

### Step 5: Test the New Endpoints

#### Test 1: Health Check
```bash
curl https://chatbot-debouncer.deno.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "Deno Deploy - Message Debouncing",
  "config": {
    "debounceDelay": 8000,
    "processingCooldown": 30000,
    "backendUrl": "https://chatbot-automation-production.up.railway.app"
  },
  "activeSessions": 0,
  "timestamp": "2025-10-30T..."
}
```

#### Test 2: Queue a Message
```bash
curl -X POST https://chatbot-debouncer.deno.dev/queue \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "test-device",
    "phone": "+60123456789",
    "name": "Test User",
    "message": "Hello world"
  }'
```

Expected response:
```json
{
  "success": true,
  "queued": true,
  "queueSize": 1,
  "willProcessIn": 8000,
  "timestamp": "2025-10-30T..."
}
```

#### Test 3: Check Status
```bash
curl https://chatbot-debouncer.deno.dev/status
```

Expected response:
```json
{
  "activeSessions": 1,
  "sessions": [
    {
      "sessionKey": "test-device:+60123456789",
      "messageCount": 1,
      "isProcessing": false,
      "lastProcessedAt": null,
      "inCooldown": false
    }
  ],
  "timestamp": "2025-10-30T..."
}
```

## What Should Change in Your Webhook Handler

Your webhook handler needs to send to the NEW endpoint:

### Before (Old):
```typescript
// Old code - DON'T USE THIS
const response = await fetch("https://chatbot-debouncer.deno.dev/webhook", {
  method: "POST",
  body: JSON.stringify({ ...oldFormat })
});
```

### After (New):
```typescript
// New code - USE THIS
const response = await fetch("https://chatbot-debouncer.deno.dev/queue", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    device_id: "your-device-id",
    phone: "+60123456789",
    name: "User Name",
    message: "The message text"
  })
});
```

## Troubleshooting

### Issue: Still showing 4000ms in logs
**Solution:** You didn't replace all the code. Copy the ENTIRE `debounce.ts` file and replace everything.

### Issue: "Not Found" when testing
**Solution:** Check the endpoint. Use `/queue` not `/webhook`.

### Issue: Backend not receiving messages
**Solution:**
1. Check `BACKEND_URL` environment variable
2. Make sure backend endpoint `/api/debounce/process` exists
3. Check Deno Deploy logs for errors

### Issue: Duplicate replies still happening
**Solution:**
1. Verify new code is deployed (check for 8000ms in logs)
2. Check `/status` endpoint to see `isProcessing` flag
3. Increase `PROCESSING_COOLDOWN` to 60000 (60 seconds) if needed

## Quick Verification Checklist

After deploying, verify these in the Deno Deploy logs:

- [ ] ✅ Shows "8000ms (8 seconds)" not "4000ms (4 seconds)"
- [ ] ✅ Shows "Processing cooldown: 30000ms"
- [ ] ✅ Shows "Deno Deploy Debounce Service Started" (new message)
- [ ] ✅ `/health` endpoint returns JSON with config
- [ ] ✅ `/queue` endpoint accepts POST requests
- [ ] ✅ `/status` endpoint shows active sessions

## Need Help?

If you see errors in the logs, copy the error message and we can debug it together.

Common errors:
- `BACKEND_URL is not defined` → Add environment variable
- `Failed to send to backend` → Check backend URL is correct
- `Invalid request body` → Check the JSON format in POST /queue
