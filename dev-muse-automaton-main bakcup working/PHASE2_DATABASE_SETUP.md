# Phase 2: Database Setup Guide

## Overview

This guide will help you set up the complete database schema in Supabase for the Chatbot Automation Platform.

## Prerequisites

- ✅ Supabase account: https://app.supabase.com
- ✅ Supabase project: `bjnjucwpwdzgsnqmpmff.supabase.co`

## Step 1: Access Supabase SQL Editor

1. Go to: https://app.supabase.com/project/bjnjucwpwdzgsnqmpmff
2. Click on **SQL Editor** in the left sidebar
3. Click **New query** button

## Step 2: Execute Schema

1. Open the file: `supabase_schema.sql` (in this repository)
2. Copy ALL the SQL content
3. Paste into Supabase SQL Editor
4. Click **Run** button (or press Ctrl+Enter / Cmd+Enter)

**Expected result**: "Success. No rows returned"

## Step 3: Verify Tables Created

Run this verification query in Supabase SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected tables** (9 total):
1. `ai_settings`
2. `ai_whatsapp`
3. `chatbot_flows`
4. `conversation_log`
5. `device_setting`
6. `execution_process`
7. `orders`
8. `stage_set_value`
9. `users`

## Step 4: Verify Test User Created

Run this query:

```sql
SELECT id, email, name, created_at FROM users;
```

**Expected result**:
- Email: `test@chatbot-automation.com`
- Name: `Test User`
- Password: `test123` (hashed)

## Database Schema Overview

### Core Tables

**users**
- User accounts and authentication
- Fields: id, email, password_hash, name

**device_setting**
- WhatsApp device configurations
- Supports 3 providers: wablas, whacenter, waha
- Fields: device_id, user_id, provider_type, api_key, status

**chatbot_flows**
- Visual flow definitions (React Flow format)
- Fields: id, device_id, flow_name, flow_data (JSONB)

**ai_whatsapp**
- Conversation tracking and history
- Fields: prospect_num, id_device, conversation_history (JSONB), stage, session_locked_until

**conversation_log**
- Message history logs
- Fields: device_id, prospect_num, message, sender, timestamp

**ai_settings**
- AI model configurations
- Fields: provider, model, api_key, temperature, max_tokens

**orders**
- Payment/billing records
- Fields: user_id, amount, status, payment_provider

**execution_process**
- Flow execution tracking
- Fields: device_id, flow_id, status, current_node_id

**stage_set_value**
- Stage-based configurations
- Fields: device_id, stage_name, value (JSONB)

### Security Features

**Row Level Security (RLS)**
- ✅ Enabled on all tables
- ✅ Users can only access their own data
- ✅ Service role has full access (for backend operations)

**Automatic Timestamps**
- ✅ `created_at` set automatically on insert
- ✅ `updated_at` updated automatically on update
- ✅ Triggers configured on all tables

### Indexes

All critical queries are optimized with indexes:
- User lookups (device_setting.user_id)
- Flow queries (chatbot_flows.device_id, is_active)
- Conversation lookups (ai_whatsapp.prospect_num + id_device)
- Message history (conversation_log.timestamp)
- Session locking (ai_whatsapp.session_locked_until)

## Step 5: Set Up Supabase Auth (Optional)

If you want to use Supabase Auth instead of custom authentication:

1. Go to **Authentication** → **Providers** in Supabase dashboard
2. Enable **Email** provider
3. Configure email templates if needed

## Step 6: Get Environment Variables

After schema setup, make sure you have these environment variables:

```env
SUPABASE_URL=https://bjnjucwpwdzgsnqmpmff.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to find them:**
1. Go to **Settings** → **API** in Supabase dashboard
2. Copy **Project URL** (SUPABASE_URL)
3. Copy **anon public** key (SUPABASE_ANON_KEY)
4. Copy **service_role** key (SUPABASE_SERVICE_ROLE_KEY) - ⚠️ Keep secret!

## Step 7: Test Connection from Backend

Once the schema is created, we can test the connection from our Go backend.

## Troubleshooting

### Error: "relation already exists"
- **Solution**: Tables already created. Run DROP TABLE commands first or skip creation.

### Error: "permission denied"
- **Solution**: Make sure you're logged in to the correct Supabase project.

### RLS Policies Not Working
- **Solution**: Verify RLS is enabled: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`

## Next Steps After Database Setup

Once the database schema is created:

1. ✅ Update backend Go code to use Supabase client
2. ✅ Create authentication system (login/register)
3. ✅ Build device management UI
4. ✅ Build flow builder UI
5. ✅ Implement WhatsApp webhooks
6. ✅ Implement AI conversation engine

## Migration from Old System

If you have existing data from the old system:

1. The schema is compatible (same table names, no `_nodepath` suffix)
2. Export data from old database
3. Import into new Supabase tables
4. Verify data integrity

## Schema Diagram

```
users
  ↓ (user_id)
device_setting
  ↓ (device_id)
chatbot_flows

device_setting
  ↓ (id_device)
ai_whatsapp ← conversation_log

users
  ↓ (user_id)
ai_settings
orders
```

## Support

If you encounter any issues:
1. Check Supabase logs: **Logs** → **Postgres Logs**
2. Verify table structure: `\d table_name` in SQL Editor
3. Check RLS policies: **Authentication** → **Policies**

---

**Status**: Ready to execute ✅
**Estimated time**: 5 minutes
**Risk level**: Low (can rollback if needed)
