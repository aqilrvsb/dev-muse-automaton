# Fix Login Issue - Step by Step Guide

## Problem Summary

Your application cannot login because:
1. The frontend uses **Supabase Auth** (`supabase.auth.signInWithPassword()`)
2. The database has a **custom user table** that isn't linked to Supabase Auth
3. The auth migration hasn't been applied yet

## Solution Overview

We need to sync Supabase Auth with your custom `user` table by running a migration that:
- Adds an `auth_user_id` column to link the tables
- Creates a trigger to automatically sync new registrations
- Updates RLS policies to use Supabase Auth

---

## Step 1: Test Current Status

1. Open `test-supabase-connection.html` in your browser
2. Click "Run All Tests" button
3. Check the results:
   - ✅ If all tests pass, the migration may already be applied
   - ❌ If "Check Auth Migration" fails, continue to Step 2

---

## Step 2: Backup Your Data (Important!)

Before running any migration, backup your database:

1. Go to https://bjnjucwpwdzgsnqmpmff.supabase.co
2. Navigate to Database → Backups
3. Create a manual backup (or just note the latest backup time)

---

## Step 3: Run the Safe Migration

### Option A: Via Supabase Dashboard (Recommended)

1. Go to https://bjnjucwpwdzgsnqmpmff.supabase.co
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Open `supabase/auth_migration_safe.sql` in this project
5. Copy ALL the contents and paste into the SQL Editor
6. Click "Run" (or press Ctrl+Enter)
7. Wait for completion - you should see "Migration completed successfully!"

### Option B: Via Supabase CLI (if installed)

```bash
# Make sure you're in the project directory
cd c:\Users\aqilz\Documents\dev-muse-automaton-main

# Login to Supabase (if not already)
supabase login

# Link to your project
supabase link --project-ref bjnjucwpwdzgsnqmpmff

# Run the migration
psql "postgresql://postgres:[YOUR-DB-PASSWORD]@db.bjnjucwpwdzgsnqmpmff.supabase.co:5432/postgres" -f supabase/auth_migration_safe.sql
```

---

## Step 4: Verify Migration

1. Refresh `test-supabase-connection.html` in your browser
2. Click "Run All Tests" again
3. Check "Test 3: Check Auth Migration Status"
   - Should show ✅ "Migration appears to be applied!"
   - Should show `auth_user_id` column exists

---

## Step 5: Test Registration

1. In `test-supabase-connection.html`, click "Test Registration"
2. This will create a test account
3. If successful, you'll see:
   - User created in Supabase Auth
   - Profile automatically created in your `user` table

Alternatively, test with your actual login page:
1. Open `frontend/index.html`
2. Click "Create Account"
3. Fill in the registration form
4. Submit

---

## Step 6: Test Login

### With Test Account:
1. Go to https://bjnjucwpwdzgsnqmpmff.supabase.co
2. Navigate to Authentication → Users
3. Find the test user you created
4. Copy the email and password you used
5. Open `frontend/index.html`
6. Enter credentials and login

### With New Account:
1. Open `frontend/index.html`
2. Register a new account
3. Check your email for confirmation (if email confirmation is enabled)
4. Try logging in

---

## Step 7: Check Supabase Settings

If registration works but you can't login immediately, check email confirmation settings:

1. Go to https://bjnjucwpwdzgsnqmpmff.supabase.co
2. Navigate to Authentication → Settings
3. Under "Email Auth", check:
   - **Enable email confirmations**: If enabled, users must confirm email before login
   - Consider disabling for testing, or configure SMTP settings

---

## Troubleshooting

### Issue: "User not found" when logging in

**Possible causes:**
- User exists in Supabase Auth but not in `user` table (trigger didn't fire)
- User exists in `user` table but not in Supabase Auth

**Solution:**
```sql
-- Check Supabase Auth users
SELECT id, email, created_at FROM auth.users;

-- Check custom user table
SELECT id, auth_user_id, email FROM public.user;

-- Manually link if needed
UPDATE public.user
SET auth_user_id = (SELECT id FROM auth.users WHERE auth.users.email = public.user.email)
WHERE auth_user_id IS NULL;
```

### Issue: "Invalid login credentials"

**Possible causes:**
- Wrong email or password
- Email not confirmed (if email confirmation is enabled)
- User account is inactive (`is_active = false`)

**Solution:**
- Check password is correct
- Check email confirmation in Supabase Dashboard → Authentication → Users
- Check `is_active` status in `user` table

### Issue: "Row Level Security policy violation"

**Possible causes:**
- RLS policies not properly configured
- User ID mismatch between auth.users and public.user

**Solution:**
Run this in SQL Editor:
```sql
-- Check if user IDs match
SELECT
  u.id as user_table_id,
  u.auth_user_id,
  u.email
FROM public.user u
WHERE u.email = 'YOUR_EMAIL_HERE';

-- Should show matching IDs
```

### Issue: Registration creates user but login fails

**Possible causes:**
- The trigger `handle_new_user()` failed
- IDs don't match between tables

**Solution:**
```sql
-- Manually create the link
UPDATE public.user
SET auth_user_id = id
WHERE auth_user_id IS NULL
AND email = 'YOUR_EMAIL_HERE';
```

---

## After Everything Works

Once login is working properly, you can optionally remove the old authentication system:

1. Run in SQL Editor:
```sql
-- Remove old password column
ALTER TABLE public.user DROP COLUMN IF EXISTS password;

-- Remove old sessions table
DROP TABLE IF EXISTS public.user_sessions CASCADE;
```

2. Delete the test file (optional):
```bash
del test-supabase-connection.html
```

---

## Important Notes

1. **Email Confirmation**: Check if Supabase requires email confirmation. This is the most common reason users can register but can't login immediately.

2. **is_active Status**: Your `user` table has an `is_active` column. Make sure it defaults to `TRUE` for new users (the migration handles this).

3. **Service Role Key**: Never expose your service role key in frontend code. Only use the anon key.

4. **RLS Policies**: The migration sets up proper RLS policies. Users can only see their own data.

---

## Need Help?

If you're still having issues:

1. Check the browser console (F12) for errors
2. Check the Network tab to see API responses
3. Verify in Supabase Dashboard:
   - Authentication → Users (check if user exists)
   - Database → user table (check if profile exists)
   - SQL Editor → Run test queries

4. Share the specific error message you're seeing
