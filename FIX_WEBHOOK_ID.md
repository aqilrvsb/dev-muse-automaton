# Fix: webhook_id → instance

## Problem Found

The code was trying to query the database using `webhook_id` field, but the actual `device_setting` table uses `instance` field instead.

### Error:
```sql
SELECT * FROM device_setting
WHERE device_id = 'FakhriAidilTLW-001'
  AND webhook_id = 'UserChatBot_FakhriAidilTLW-001';  -- ❌ WRONG FIELD

-- Returns: NULL (no rows found)
```

### Correct Query:
```sql
SELECT * FROM device_setting
WHERE device_id = 'FakhriAidilTLW-001'
  AND instance = 'UserChatBot_FakhriAidilTLW-001';  -- ✅ CORRECT FIELD

-- Returns: The device record
```

---

## Files Fixed

### 1. `deno-backend/handlers/webhook.ts`

**Line 33-34:** Changed query field
```typescript
// BEFORE:
.eq("webhook_id", webhookId)

// AFTER:
.eq("instance", webhookId)
```

**Line 45:** Fixed log output
```typescript
// BEFORE:
console.log(`✅ Device found: ${device.id_device} (Provider: ${device.provider})`);

// AFTER:
console.log(`✅ Device found: ${device.device_id} (Provider: ${device.provider})`);
```

**Line 163:** Fixed field access
```typescript
// BEFORE:
webhookId: device.webhook_id,

// AFTER:
webhookId: device.instance, // instance field is used as webhookId
```

**Line 113:** Fixed response field
```typescript
// BEFORE:
webhook_id: device.webhook_id,

// AFTER:
instance: device.instance,
```

---

### 2. `deno-backend/services/flow-execution.ts`

**Line 43-44:** Changed query field
```typescript
// BEFORE:
.eq("webhook_id", webhookId)

// AFTER:
.eq("instance", webhookId)
```

---

## Database Schema Reference

### device_setting table structure:
```sql
CREATE TABLE device_setting (
  id_device SERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  instance VARCHAR(255) NOT NULL,     -- ← THIS is the "webhook ID"
  provider VARCHAR(50),
  api_key TEXT,
  api_key_option VARCHAR(100),
  phone_number VARCHAR(50),
  user_id UUID REFERENCES "user"(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Important:**
- `device_id` = Unique identifier for the device (e.g., "FakhriAidilTLW-001")
- `instance` = WAHA session name / webhook identifier (e.g., "UserChatBot_FakhriAidilTLW-001")
- There is NO `webhook_id` field in the table!

---

## Webhook URL Pattern

```
POST https://pening-bot.deno.dev/{device_id}/{instance}
```

**Example:**
```
POST https://pening-bot.deno.dev/FakhriAidilTLW-001/UserChatBot_FakhriAidilTLW-001
                                 ^^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                 device_id         instance (webhook identifier)
```

The second part of the URL path corresponds to the `instance` field, not `webhook_id`.

---

## Why This Happened

The original code was written assuming a `webhook_id` column existed in the database, but the actual schema uses `instance` instead. This is because:

1. **WAHA provider** uses "instance" terminology for sessions
2. **device_setting** table was designed to store WAHA session names
3. **URL pattern** uses the instance name as the webhook identifier

---

## Verification

After deploying these fixes, verify the device query works:

```sql
-- Test the query that the code will run
SELECT device_id, instance, provider, user_id
FROM device_setting
WHERE device_id = 'FakhriAidilTLW-001'
  AND instance = 'UserChatBot_FakhriAidilTLW-001';
```

Expected result:
```
device_id            | instance                          | provider | user_id
---------------------|-----------------------------------|----------|----------
FakhriAidilTLW-001  | UserChatBot_FakhriAidilTLW-001   | waha     | uuid-...
```

---

## Deploy Command

```bash
cd "C:\Users\User\Pictures\dev-muse-automaton-main\deno-backend"
deployctl deploy --project=pening-bot main.ts
```

After deployment, test by sending a WhatsApp message to your bot!

---

## Related Files

All references to `webhook_id` have been changed to `instance`:
- ✅ `deno-backend/handlers/webhook.ts` (3 changes)
- ✅ `deno-backend/services/flow-execution.ts` (1 change)

The parameter name `webhookId` in function signatures remains the same (it's just a variable name), but it now correctly queries the `instance` field in the database.
