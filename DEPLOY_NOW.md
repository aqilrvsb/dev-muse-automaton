# Deploy Updated Code to Deno Deploy

## Problems Fixed

### Problem 1: Old Production Code
Your production Deno Deploy instance is running **old code** that doesn't match your local files.

**Evidence:**
- Error shows: `at queueMessageForDebouncing (file:///src/main.ts:190:34)`
- Your local main.ts only has 261 lines
- Production code has debounce logic embedded in main.ts
- Local code uses separate service files

### Problem 2: Wrong Database Field ✅ FIXED
The code was querying `webhook_id` field, but your database uses `instance` field.

**Evidence:**
- Query returns null: `Device found by device_id: null`
- Your SQL test: `WHERE webhook_id = '...'` returns no results
- Correct SQL: `WHERE instance = '...'` returns the device ✅

**Fix Applied:**
- Changed `webhook.ts`: `.eq("webhook_id", webhookId)` → `.eq("instance", webhookId)`
- Changed `flow-execution.ts`: `.eq("webhook_id", webhookId)` → `.eq("instance", webhookId)`
- Changed field access: `device.webhook_id` → `device.instance`

See [FIX_WEBHOOK_ID.md](FIX_WEBHOOK_ID.md) for detailed changes.

## Solution

Deploy the updated code to Deno Deploy with both fixes applied.

---

## Quick Deploy Steps

### Option 1: Deploy via deployctl (Recommended)

```bash
# Navigate to deno-backend directory
cd "C:\Users\User\Pictures\dev-muse-automaton-main\deno-backend"

# Deploy to Deno Deploy
deployctl deploy --project=pening-bot main.ts
```

### Option 2: Deploy via GitHub (if linked)

1. **Commit and push your changes:**
   ```bash
   cd "C:\Users\User\Pictures\dev-muse-automaton-main"
   git add .
   git commit -m "Fix: Update to prompt-based AI system with separate service files"
   git push origin master
   ```

2. **Deno Deploy will auto-deploy** (if GitHub integration is configured)

---

## Verify Deployment

After deployment, test the webhook:

```bash
# Test health check
curl https://pening-bot.deno.dev/health

# Expected response:
# {"status":"ok","service":"dev-muse-automaton-deno"}
```

Then send a test message from WhatsApp and check the logs:
https://dash.deno.com/projects/pening-bot/logs

---

## Why This Error Happened

The production error shows:

```
❌ Webhook error: TypeError: expected string, number, bigint, ArrayBufferView, boolean
    at Kv.get (ext:deno_kv/01_db.ts:57:34)
    at queueMessageForDebouncing (file:///src/main.ts:190:34)
```

This is happening because:

1. **Old production code** has debounce logic directly in main.ts
2. **Device query returns null** → `device.device_id` is undefined
3. **Deno KV key array** contains undefined value: `["message_queue", undefined, "6017964504"]`
4. **Deno KV rejects** the key because it contains non-primitive values

Your **new local code** fixes this by:
- Using separate service files (debounce.ts, flow-execution.ts)
- Better error handling when device is not found
- Proper device_id extraction from webhook path

---

## What the New Code Does Differently

### Old Code (Production - Has Issues):
```typescript
// In main.ts (embedded):
const queueKey = ["message_queue", deviceId, phone];
// If device is null, deviceId is undefined → KV error
const result = await kv.get<QueuedMessage>(queueKey);
```

### New Code (Local - Fixed):
```typescript
// In services/debounce.ts:
export async function queueMessageForDebouncing(params: QueueMessageParams): Promise<void> {
  const { deviceId, webhookId, phone, message, name, provider } = params;
  // deviceId is validated before this function is called
  const queueKey = ["message_queue", deviceId, phone];
  const result = await kv.get<QueuedMessage>(queueKey);
  // ...
}

// In handlers/webhook.ts:
if (deviceError || !device) {
  console.error("❌ Device not found:", deviceError);
  return new Response(
    JSON.stringify({ success: false, error: "Device not found" }),
    { status: 404, headers: corsHeaders }
  );
}
// Only queue if device exists ✅
await queueMessageForDebouncing({
  deviceId: device.device_id,  // Now guaranteed to exist
  // ...
});
```

---

## After Deployment

Once deployed, the system will:

1. ✅ Find device correctly using device_id
2. ✅ Load prompt from prompts table
3. ✅ Create/update conversation in ai_whatsapp
4. ✅ Generate AI response using prompts_data
5. ✅ Send reply via WhatsApp

Test by sending "Hello" from your WhatsApp number to the bot!

---

## Troubleshooting

### If deployment fails:

**Check environment variables are set:**
- Go to: https://dash.deno.com/projects/pening-bot/settings
- Required variables:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `JWT_SECRET`

### If device still not found:

**Check database:**
```sql
-- Run this in Supabase SQL Editor
SELECT device_id, webhook_id, provider, user_id
FROM device_setting
WHERE device_id = 'FakhriAidilTLW-001'
  AND webhook_id = 'UserChatBot_FakhriAidilTLW-001';
```

If no results, the device doesn't exist. Create it via the frontend Device Settings page.

### If no prompt error:

**Check prompts table:**
```sql
SELECT id, device_id, niche, prompts_name
FROM prompts
WHERE device_id = 'FakhriAidilTLW-001';
```

If no results, create a prompt via the frontend Prompts page.

---

## Deploy Now!

```bash
cd "C:\Users\User\Pictures\dev-muse-automaton-main\deno-backend"
deployctl deploy --project=pening-bot main.ts
```

Watch the logs: https://dash.deno.com/projects/pening-bot/logs
