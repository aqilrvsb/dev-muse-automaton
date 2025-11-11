# AI WhatsApp Table Migration Guide

## Overview

This migration updates the `ai_whatsapp` table schema to a simplified version with better user isolation using Row Level Security (RLS).

## Changes

### Renamed Columns
- `id_device` → `device_id`

### New Columns Added
- `user_id` (UUID, FK to `"user"(id)`) - Links records to users for RLS
- `date_insert` (DATE, default CURRENT_DATE) - Date format Y-m-d
- `detail` (TEXT) - Additional detail information

### Columns Removed
- `keywordiklan`
- `marketer`
- `balas`
- `waiting_for_reply`
- `last_node_id`
- `current_node_id`
- `flow_id`
- `execution_status`
- `created_at`
- `updated_at`

### Kept Columns
- `id_prospect` (serial, PK)
- `device_id` (varchar 255) - renamed from `id_device`
- `prospect_name` (varchar 225)
- `prospect_num` (varchar 255, unique)
- `niche` (varchar 255)
- `intro` (varchar 255)
- `stage` (varchar 255)
- `conv_last` (text)
- `conv_current` (text)
- `human` (integer, default 0)
- `detail` (text) - NEW

### Indexes Updated
**Removed:**
- `ai_whatsapp_execution_status_idx`
- `ai_whatsapp_waiting_for_reply_idx`
- `ai_whatsapp_flow_id_idx`
- `ai_whatsapp_current_node_id_idx`
- `ai_whatsapp_id_device_idx`
- `ai_whatsapp_created_at_idx`

**Added:**
- `ai_whatsapp_device_id_idx` (on `device_id`)
- `ai_whatsapp_user_id_idx` (on `user_id`)
- `ai_whatsapp_date_insert_idx` (on `date_insert`)

**Kept:**
- `ai_whatsapp_prospect_num_idx` (on `prospect_num`)
- `ai_whatsapp_stage_idx` (on `stage`)
- `ai_whatsapp_human_idx` (on `human`)
- `ai_whatsapp_niche_idx` (on `niche`)

### Security
- Enabled Row Level Security (RLS)
- Created policies so users can only access their own records

## Migration Steps

1. **Backup your data first!** Always backup before running migrations.

2. Go to your Supabase Dashboard

3. Navigate to **SQL Editor**

4. Copy and paste the SQL from `database/migrate_ai_whatsapp_table.sql`

5. Click **Run** to execute the migration

6. Verify the migration:
   ```sql
   -- Check table structure
   SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'ai_whatsapp'
   ORDER BY ordinal_position;

   -- Check indexes
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'ai_whatsapp';

   -- Check RLS policies
   SELECT policyname, permissive, roles, cmd, qual, with_check
   FROM pg_policies
   WHERE tablename = 'ai_whatsapp';
   ```

## Important Notes

1. **Existing Data**: The migration will preserve all existing data in the columns that are kept. However:
   - You may need to manually populate the `user_id` column for existing records
   - The `date_insert` will be set to the current date for existing records

2. **Populate user_id for existing records** (if needed):
   ```sql
   -- Example: Update user_id based on device_id relationships
   UPDATE ai_whatsapp a
   SET user_id = ds.user_id
   FROM device_setting ds
   WHERE a.device_id = ds.device_id
   AND a.user_id IS NULL;
   ```

3. **RLS Impact**: After enabling RLS, queries must be authenticated with a valid user session, or they won't return any rows. Make sure your application passes the user authentication token when querying.

4. **Trigger Removed**: The `update_ai_whatsapp_updated_at` trigger will be dropped since we're removing the `updated_at` column.

## Rollback (Emergency Only)

If you need to rollback, you'll need to:
1. Restore from your backup
2. Or manually recreate the dropped columns and indexes

**Always test migrations in a development environment first!**

## After Migration

Update your TypeScript types and application code to reflect the new schema:

```typescript
export type AIWhatsApp = {
  id_prospect: number
  device_id: string
  prospect_name: string
  prospect_num: string
  niche: string
  intro: string
  stage: string
  conv_last: string
  conv_current: string
  human: number
  date_insert: string  // Y-m-d format
  user_id: string
  detail: string
}
```
