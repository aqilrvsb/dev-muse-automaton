# Deploy Deno KV Version - Fix for Multiple Isolates

## Problem

The current `debounce.ts` uses in-memory `Map` storage, which is NOT shared across Deno Deploy isolates. This causes:
- Messages split across different isolates
- Multiple separate batches processed
- Duplicate replies sent

**Example from your logs:**
- Isolate 1 processed: "Hai" (alone)
- Isolate 2 processed: "Nak tanye sikit" + "Boleh?" (together)
- Result: **2 separate replies** instead of 1 combined reply

## Solution

Use **Deno KV** (persistent key-value database) which is shared across ALL isolates on Deno Deploy.

## How to Deploy

### Step 1: Replace the File on Deno Deploy

1. Go to: https://dash.deno.com/projects/chatbot-debouncer
2. Click **Settings** tab
3. Click **Deployments**
4. Click **Deploy from GitHub** or **Deploy manually**

### Step 2: Upload New Code

**Option A: Via Dashboard (Quick)**
1. Click **Deployments** → **Create Deployment**
2. Select **Upload file**
3. Upload `deno/debounce-kv.ts` (the NEW file)
4. Set entry point: `debounce-kv.ts`
5. Click **Deploy**

**Option B: Via GitHub (Recommended)**
1. Push `debounce-kv.ts` to GitHub:
   ```bash
   git add deno/debounce-kv.ts
   git commit -m "ADD: Deno KV version for shared state across isolates"
   git push
   ```

2. In Deno Deploy dashboard:
   - Click **Settings** → **Git Integration**
   - Change entry point from `debounce.ts` to `debounce-kv.ts`
   - Save and redeploy

### Step 3: Verify Environment Variables

Ensure the `BACKEND_URL` is still set:
1. Go to **Settings** → **Environment Variables**
2. Check: `BACKEND_URL = https://chatbot-automation-production.up.railway.app`

### Step 4: Test the Deployment

1. Check health endpoint:
   ```bash
   curl https://chatbot-debouncer.deno.dev/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "config": {
       "debounceDelay": 8000,
       "processingCooldown": 30000,
       "backendUrl": "https://chatbot-automation-production.up.railway.app"
     }
   }
   ```

2. Send test messages to your WhatsApp bot
3. Check logs for:
   ```
   "New session created" (only ONCE per user)
   "Message queued" (for each message)
   "Processing combined messages" (ONCE after 8 seconds)
   ```

## Key Differences: Old vs New

### Old Version (debounce.ts)
```typescript
// In-memory Map (NOT shared across isolates)
const messageQueue = new Map<string, Session>();

// Each isolate has its own queue
// Isolate 1: processes "Hai"
// Isolate 2: processes "Nak tanye sikit" + "Boleh?"
// Result: 2 separate batches = 2 replies ❌
```

### New Version (debounce-kv.ts)
```typescript
// Deno KV database (SHARED across ALL isolates)
const kv = await Deno.openKv();

// All isolates access the same session
// Any isolate can add messages to the queue
// Only one isolate processes the combined batch
// Result: 1 batch = 1 reply ✅
```

## How It Works

### Timer System

The new version uses a **background worker** that runs on all isolates:

```typescript
async function startTimerWorker() {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Check every second

    // Get ALL sessions from KV
    const entries = kv.list<Session>({ prefix: ["session"] });

    for await (const entry of entries) {
      const session = entry.value;
      const timeSinceLastMessage = Date.now() - session.lastMessageAt;

      if (timeSinceLastMessage >= DEBOUNCE_DELAY) {
        processMessages(sessionKey); // Process if 8 seconds passed
      }
    }
  }
}
```

**Benefits:**
- ✅ Runs continuously on all isolates
- ✅ Checks shared KV storage every second
- ✅ Only processes when timer truly expires
- ✅ Prevents duplicate processing with `isProcessing` flag

### Message Flow

```
User sends: "Hai"
    ↓
Isolate A receives → Saves to KV → sets lastMessageAt
    ↓
Worker on Isolate A checks: timeSince < 8s → wait
    ↓
User sends: "Nak tanye sikit"
    ↓
Isolate B receives → Saves to KV → updates lastMessageAt
    ↓
Worker on Isolate B checks: timeSince < 8s → wait
    ↓
User sends: "Boleh?"
    ↓
Isolate A receives → Saves to KV → updates lastMessageAt
    ↓
Workers on ALL isolates check: timeSince < 8s → wait
    ↓
[8 seconds pass with no new messages]
    ↓
Worker on Isolate A checks: timeSince >= 8s → Process!
Worker on Isolate B checks: timeSince >= 8s BUT sees isProcessing=true → Skip
    ↓
Isolate A processes ALL 3 messages together
    ↓
Sends to backend: ["Hai", "Nak tanye sikit", "Boleh?"]
    ↓
Sets: isProcessing=false, lastProcessedAt=now
    ↓
30-second cooldown starts
    ↓
Session cleaned up after cooldown
```

## Troubleshooting

### Issue: Still getting duplicates

**Check:**
1. Verify KV version is deployed (check logs for "KV-based")
2. Check status endpoint: `curl https://chatbot-debouncer.deno.dev/status`
3. Look for multiple sessions with same sessionKey

**Solution:**
- Clear old sessions: They'll auto-cleanup after 30 seconds
- Restart Deno Deploy: Settings → Restart

### Issue: Messages not being processed

**Check:**
1. Background worker logs
2. Status endpoint shows messages in queue
3. `lastMessageAt` timestamp

**Solution:**
- Verify worker is running (check for timer checks in logs)
- Check BACKEND_URL is correct

### Issue: "Session is processing" for too long

**Check:**
- Backend response time
- Network issues

**Solution:**
- Increase timeout or reduce cooldown period
- Check backend logs for errors

## Rollback (If Needed)

If the KV version has issues, you can roll back:

1. Go to Deno Deploy dashboard
2. Settings → Deployments
3. Change entry point back to `debounce.ts`
4. Redeploy

## Summary

The **Deno KV version** solves the multiple isolate problem by:
- ✅ Using shared persistent storage (Deno KV)
- ✅ Background worker checks timers every second
- ✅ Processing flag prevents race conditions
- ✅ Guarantees single batch processing
- ✅ **No more duplicate replies!**

After deploying this version, you should see **only ONE combined reply** even when messages are handled by different isolates.
