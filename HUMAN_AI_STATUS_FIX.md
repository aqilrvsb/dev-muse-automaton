# Human/AI Status Update Fix

## Problem Summary

The "Change Status" feature in the Chatbot AI page was not working. Users couldn't toggle between AI and Human modes.

## Root Causes Identified

### 1. Missing RLS UPDATE Policy
**Issue**: The `ai_whatsapp` table had Row Level Security (RLS) enabled but only had SELECT policy, no UPDATE policy.

**Impact**: Users could view conversations but couldn't update the `human` field when clicking AI/Human buttons.

**Fix**: Created migration `supabase/migrations/add_update_policies_ai_whatsapp.sql` to add UPDATE policies.

### 2. Inconsistent `human` Field Values
**Issue**: Backend and frontend were using different values for AI mode:
- Backend webhook commands: `human = null` for AI mode
- Frontend UI: `human = 0` for AI mode
- Backend new conversation: `human = 0` for AI mode

**Impact**: While functionally it worked (both 0 and null would trigger AI processing), it created data inconsistency.

**Fix**: Standardized to use `null` for AI mode across the entire codebase.

## Files Modified

### 1. Frontend: ChatbotAI.tsx
**File**: `src/pages/ChatbotAI.tsx`

**Change**: Line 330
```typescript
// Before
const newHumanValue = result.isDenied ? 1 : 0

// After
const newHumanValue = result.isDenied ? 1 : null
```

**Why**: Match backend convention where `null` = AI mode, `1` = Human mode

### 2. Backend: complete-webhook-single-file.ts
**File**: `deno-backend/complete-webhook-single-file.ts`

**Change**: Line 264
```typescript
// Before
human: 0,

// After
human: null,  // ✅ FIXED: Default to null (AI mode) for consistency with commands
```

**Why**: New conversations now default to `null` (AI mode) instead of `0`

### 3. Database Migration: add_update_policies_ai_whatsapp.sql
**File**: `supabase/migrations/add_update_policies_ai_whatsapp.sql` (NEW)

**What it does**:
- Adds UPDATE policy for `ai_whatsapp` table
- Adds UPDATE policy for `wasapbot` table
- Grants UPDATE permissions to authenticated users
- Ensures users can only update conversations from devices they own

## How It Works Now

### Data Model
- `human = null` → AI mode (bot processes messages automatically)
- `human = 1` → Human mode (bot skips processing, human takes over)

### Frontend (React UI)
1. User clicks "AI" or "Human" button on a conversation
2. SweetAlert2 modal confirms the action
3. Frontend updates `ai_whatsapp.human` field via Supabase
4. RLS policy checks user owns the device before allowing update
5. Success message shown, table refreshes

### Backend (Webhook)
1. Incoming WhatsApp message triggers webhook
2. Webhook fetches conversation from `ai_whatsapp` table
3. Checks `if (conversation.human === 1)`
   - If `true` → Skip AI processing, return (human is handling)
   - If `false/null` → Continue with AI processing
4. AI generates response and sends via WhatsApp API

### Backend Commands (from WhatsApp)
- **`cmd`** → Sets `human = 1` (activate human mode for current conversation)
- **`dmc`** → Sets `human = null` (deactivate human mode, back to AI)
- **`/[phone]`** → Sets `human = 1` for specified phone number
- **`?[phone]`** → Sets `human = null` for specified phone number

## Deployment Steps

### Step 1: Run SQL Migration in Supabase

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy the contents of `supabase/migrations/add_update_policies_ai_whatsapp.sql`
3. Paste and **Run** the SQL query
4. Verify success message: "UPDATE policies added for ai_whatsapp and wasapbot tables!"

### Step 2: Deploy Frontend Changes

1. Commit changes to git:
   ```bash
   git add src/pages/ChatbotAI.tsx
   git commit -m "Fix Human/AI status update - use null for AI mode"
   git push
   ```

2. Vercel will auto-deploy, or manually trigger deployment

### Step 3: Deploy Backend Changes

1. Deploy the updated `deno-backend/complete-webhook-single-file.ts` to your Deno Deploy project
2. Or commit and push if auto-deployment is configured

### Step 4: Test the Feature

1. Navigate to **Chatbot AI** page
2. Click the status badge (AI/Human) for any conversation
3. Click "Human" → Status should change to Human
4. Click "AI" → Status should change back to AI
5. Check database to verify `human` field is `1` or `null`

## Database Structure

### ai_whatsapp Table
```sql
CREATE TABLE ai_whatsapp (
  id_prospect SERIAL PRIMARY KEY,
  device_id VARCHAR,
  niche VARCHAR,
  prospect_name VARCHAR,
  prospect_num VARCHAR UNIQUE,
  intro VARCHAR,
  stage VARCHAR,
  conv_last TEXT,
  conv_current TEXT,
  human INTEGER DEFAULT 0,  -- Should be NULL for new records now
  date_insert DATE DEFAULT CURRENT_DATE,
  user_id UUID REFERENCES user(id),
  detail TEXT
);
```

### RLS Policies
```sql
-- SELECT: Users can view conversations from their own devices
CREATE POLICY "Users can view own device ai_whatsapp"
ON ai_whatsapp FOR SELECT
TO authenticated
USING (device_id IN (
  SELECT device_id FROM device_setting WHERE user_id = auth.uid()
));

-- UPDATE: Users can update conversations from their own devices (NEW)
CREATE POLICY "Users can update own device ai_whatsapp"
ON ai_whatsapp FOR UPDATE
TO authenticated
USING (device_id IN (
  SELECT device_id FROM device_setting WHERE user_id = auth.uid()
))
WITH CHECK (device_id IN (
  SELECT device_id FROM device_setting WHERE user_id = auth.uid()
));
```

## Testing Checklist

- [ ] SQL migration executed successfully in Supabase
- [ ] Frontend deployed with updated ChatbotAI.tsx
- [ ] Backend deployed with updated complete-webhook-single-file.ts
- [ ] Can change status from AI to Human via UI
- [ ] Can change status from Human to AI via UI
- [ ] Database shows `human = 1` for Human mode
- [ ] Database shows `human = null` for AI mode
- [ ] Webhook skips AI processing when `human = 1`
- [ ] Webhook processes with AI when `human = null`
- [ ] WhatsApp commands `cmd` and `dmc` work correctly
- [ ] Non-admin users can only update their own device conversations
- [ ] Admin users can update all conversations

## Security Notes

- RLS policies ensure users can only update conversations from devices they own
- Service role has full access for backend operations
- Updates are audited via Supabase logs
- No sensitive data exposed in error messages

## Future Improvements

1. Add audit logging for status changes
2. Add webhook notification when status changes
3. Show "Last changed by" timestamp in UI
4. Add bulk status change capability
5. Add status change history/timeline

## Troubleshooting

**Issue**: Status doesn't change when clicking buttons
- **Check**: RLS policies are enabled: `SELECT * FROM pg_policies WHERE tablename = 'ai_whatsapp'`
- **Check**: User's device_id matches conversation's device_id
- **Check**: Browser console for errors

**Issue**: AI still responds in Human mode
- **Check**: Database shows `human = 1` for the conversation
- **Check**: Webhook logs show "Human mode active, skipping AI processing"
- **Check**: Backend deployed with latest code

**Issue**: Permission denied error
- **Check**: RLS UPDATE policy exists
- **Check**: User is authenticated
- **Check**: User owns the device linked to the conversation

## Related Files

- Frontend: `src/pages/ChatbotAI.tsx`
- Backend: `deno-backend/complete-webhook-single-file.ts`
- Migration: `supabase/migrations/add_update_policies_ai_whatsapp.sql`
- Previous RLS: `supabase/enable_rls_dashboard_tables.sql`
