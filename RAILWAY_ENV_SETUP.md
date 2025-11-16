# Railway Environment Variable Setup

## ⚠️ REQUIRED: Add Service Role Key to Railway

The backend needs the **Supabase Service Role Key** to bypass RLS policies for admin operations.

## Error You're Seeing

```json
{
  "error": "supabase error: 401 Unauthorized - {\"message\":\"No API key found in request\",\"hint\":\"No `apikey` request header or url param was found.\"}"
}
```

**Cause:** `SUPABASE_SERVICE_ROLE_KEY` environment variable is not set in Railway.

---

## How to Add Service Role Key in Railway

### Step 1: Get Your Service Role Key from Supabase

1. Go to: https://app.supabase.com/project/bjnjucwpwdzgsnqmpmff/settings/api
2. Scroll to **"Project API keys"** section
3. Find **"service_role"** key (⚠️ SECRET - never expose to frontend!)
4. Click the copy icon to copy it

**It looks like:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqbmp1Y3dwd2R6Z3NucW1wbWZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDQ5OTUzOSwiZXhwIjoyMDc2MDc1NTM5fQ.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Step 2: Add to Railway Environment Variables

1. Go to Railway project: https://railway.app/project/[your-project-id]
2. Click on your service (the one deploying this app)
3. Go to **"Variables"** tab
4. Click **"New Variable"**
5. Add:
   - **Variable Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** (paste the service_role key from Supabase)
6. Click **"Add"**

### Step 3: Railway Will Auto-Redeploy

- Railway automatically redeploys when you add environment variables
- Wait ~2-3 minutes for deployment to complete

### Step 4: Verify It Works

Test the endpoint:
```
https://chatbot-automation-production.up.railway.app/api/db/test
```

**Expected response (FIXED):**
```json
{
  "success": true,
  "message": "Database connection working!",
  "users": "[{\"id\":\"...\",\"email\":\"test@chatbot-automation.com\",\"full_name\":\"Test User\",\"status\":\"Trial\"}]"
}
```

---

## Current Environment Variables Needed

| Variable | Value | Where to Get |
|----------|-------|-------------|
| `SUPABASE_URL` | https://bjnjucwpwdzgsnqmpmff.supabase.co | Built into code (fallback) |
| `SUPABASE_ANON_KEY` | eyJ...TNU | Built into code (fallback) |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ **MISSING** | Supabase → Settings → API → service_role |

---

## Security Note

### ⚠️ NEVER expose service_role key to frontend!

**Service Role Key:**
- ✅ Use in backend/server code only
- ✅ Set as Railway environment variable
- ✅ Bypasses ALL Row Level Security
- ❌ NEVER in frontend JavaScript
- ❌ NEVER in Git repository
- ❌ NEVER in Docker build args

**Anon Key:**
- ✅ Safe to use in frontend
- ✅ Respects Row Level Security
- ✅ Can be in Git (it's public)

---

## Quick Copy-Paste Instructions

1. **Get service_role key:**
   - https://app.supabase.com/project/bjnjucwpwdzgsnqmpmff/settings/api
   - Copy "service_role" key

2. **Add to Railway:**
   - Go to Railway project → Variables
   - New Variable: `SUPABASE_SERVICE_ROLE_KEY`
   - Paste the key
   - Save

3. **Wait for redeploy** (~2-3 minutes)

4. **Test:**
   - https://chatbot-automation-production.up.railway.app/api/db/test
   - Should show test user data

---

## Troubleshooting

### Still getting 401 error?
- Check the variable name is exactly: `SUPABASE_SERVICE_ROLE_KEY`
- Check you copied the **service_role** key (not anon key)
- Check Railway redeployed after adding variable

### Getting empty array `"users":"[]"`?
- Run the INSERT query in Supabase to create test user:
  ```sql
  INSERT INTO "user" (id, email, full_name, password, status)
  VALUES (
    uuid_generate_v4(),
    'test@chatbot-automation.com',
    'Test User',
    '$2a$10$8K1p/a0dL3gBt5KeGvXnVe6VfJZWG4qV0QnLfJZQXBqWGzqJvYXGy',
    'Trial'
  );
  ```

---

**Status:** Required - must be completed before Phase 3
