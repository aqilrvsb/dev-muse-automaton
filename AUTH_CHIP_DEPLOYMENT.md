# Authentication & CHIP Payment Deployment Guide

Complete step-by-step guide to deploy Supabase Auth and CHIP payment integration.

---

## Overview

This guide covers:
1. ✅ Migrating from custom auth to Supabase Auth
2. ✅ Integrating CHIP payment gateway
3. ✅ Deploying Edge Functions
4. ✅ Database migrations
5. ✅ Testing authentication and payments

---

## Prerequisites

- [ ] Supabase project: `https://bjnjucwpwdzgsnqmpmff.supabase.co`
- [ ] Supabase CLI installed: `npm install -g supabase`
- [ ] CHIP payment account with Brand ID and Secret Key
- [ ] Git repository set up

---

## Step 1: Link Supabase Project

```bash
cd c:\Users\aqilz\Documents\dev-muse-automaton-main
supabase link --project-ref bjnjucwpwdzgsnqmpmff
```

You'll be prompted for your Supabase database password.

---

## Step 2: Deploy Edge Functions

Deploy both Edge Functions to Supabase:

```bash
# Deploy get-email-from-user function (for flexible login)
supabase functions deploy get-email-from-user

# Deploy chip-payment-topup function (for payments)
supabase functions deploy chip-payment-topup
```

**Expected output:**
```
✓ Deployed Function get-email-from-user
✓ Deployed Function chip-payment-topup
```

---

## Step 3: Set Environment Variables

Set CHIP payment credentials:

```bash
supabase secrets set CHIP_BRAND_ID=your_brand_id_here
supabase secrets set CHIP_SECRET_KEY=your_secret_key_here
supabase secrets set CHIP_API_URL=https://gate.chip-in.asia/api/v1
```

**Or via Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/bjnjucwpwdzgsnqmpmff/settings/functions
2. Click "Edge Functions" → "Secrets"
3. Add:
   - `CHIP_BRAND_ID`
   - `CHIP_SECRET_KEY`
   - `CHIP_API_URL`

---

## Step 4: Run Database Migrations

### 4.1 CHIP Payment Schema

1. Open **Supabase Dashboard** → **SQL Editor**
2. Create new query
3. Copy contents of `supabase/chip_payment_schema.sql`
4. Click **"Run"**

This creates:
- ✅ `packages` table with 3 default plans (Starter, Pro, Enterprise)
- ✅ `payments` table for tracking CHIP payments
- ✅ Subscription fields on `user` table
- ✅ RLS policies for security
- ✅ Helper functions

### 4.2 Auth Migration

1. Open **Supabase Dashboard** → **SQL Editor**
2. Create new query
3. Copy contents of `supabase/auth_migration.sql`
4. Click **"Run"**

This migrates:
- ✅ Removes old `password` column from `user` table
- ✅ Removes old `user_sessions` table
- ✅ Links `public.user` with `auth.users`
- ✅ Creates trigger to auto-create user profiles on signup
- ✅ Sets up RLS policies

---

## Step 5: Enable Email Auth

1. Go to: https://supabase.com/dashboard/project/bjnjucwpwdzgsnqmpmff/auth/providers
2. Enable **Email** provider
3. Configure settings:
   - ✅ **Confirm email:** Enabled (recommended)
   - ✅ **Secure email change:** Enabled
   - ✅ **Enable anonymous sign-ins:** Disabled

---

## Step 6: Configure CHIP Webhook

Set webhook URL in CHIP dashboard:

**Webhook URL:**
```
https://bjnjucwpwdzgsnqmpmff.supabase.co/functions/v1/chip-payment-topup
```

**Events:**
- `payment.paid`
- `payment.success`

---

## Step 7: Update Frontend Files

Your frontend files are already configured correctly:

### ✅ auth.js
Located at: `frontend/assets/js/auth.js`
- Uses Supabase Auth
- Calls `get-email-from-user` Edge Function for flexible login
- Checks user active status

### ✅ chip-payment.js
Located at: `frontend/assets/js/chip-payment.js`
- Calls `chip-payment-topup` Edge Function
- Manages subscriptions

### ✅ index.html
Located at: `frontend/index.html`
- Loads auth.js as ES6 module
- Contains login/register forms

---

## Step 8: Test Authentication

### 8.1 Create Test User

1. Open `frontend/index.html` in browser (or deploy first)
2. Click **"Sign Up"**
3. Enter:
   - **Name:** Test User
   - **Email:** test@example.com
   - **Password:** password123
4. Check email for confirmation link
5. Click confirmation link
6. Login with credentials

### 8.2 Verify in Database

```sql
-- Check auth.users
SELECT id, email, created_at, confirmed_at
FROM auth.users;

-- Check public.user (auto-created by trigger)
SELECT id, email, full_name, is_active
FROM public.user;
```

Both should have the same user with matching IDs.

---

## Step 9: Test CHIP Payment

### 9.1 Get Package ID

```sql
-- Get Starter package ID
SELECT id, name, price
FROM public.packages
WHERE name = 'Starter';
```

Copy the UUID.

### 9.2 Create Test Payment

Use browser console:

```javascript
// Import function
const { createPayment } = await import('/assets/js/chip-payment.js');

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Create payment
const payment = await createPayment({
    userId: user.id,
    packageId: 'PASTE_STARTER_PACKAGE_UUID_HERE',
    amount: 29.00
});

console.log('Payment URL:', payment.checkout_url);
```

### 9.3 Complete Payment

1. Open `payment.checkout_url` in new tab
2. Use CHIP test card:
   - **Card:** 4242 4242 4242 4242
   - **CVV:** 123
   - **Expiry:** Any future date
3. Complete payment

### 9.4 Verify Subscription Activated

```sql
SELECT
  id,
  email,
  subscription_status,
  subscription_start,
  subscription_end,
  max_devices
FROM public.user
WHERE email = 'test@example.com';
```

Should show:
- `subscription_status` = `'active'`
- `subscription_end` = 30 days from now
- `max_devices` = 1

---

## Step 10: Deploy Frontend

### Option A: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel --prod
```

### Option B: Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
cd frontend
netlify deploy --prod
```

### Option C: GitHub Pages

```bash
# Push to GitHub
git add .
git commit -m "Add Supabase Auth and CHIP payment"
git push origin main

# Enable GitHub Pages in repository settings
# Source: main branch / root folder
```

---

## Verification Checklist

- [ ] Supabase project linked
- [ ] `get-email-from-user` Edge Function deployed
- [ ] `chip-payment-topup` Edge Function deployed
- [ ] CHIP secrets set in Supabase
- [ ] `chip_payment_schema.sql` executed
- [ ] `auth_migration.sql` executed
- [ ] Email auth enabled
- [ ] CHIP webhook URL configured
- [ ] Test user can signup
- [ ] Test user receives confirmation email
- [ ] Test user can login
- [ ] Test payment creates checkout URL
- [ ] Test payment activates subscription
- [ ] Frontend deployed

---

## Troubleshooting

### Issue: "Invalid API key" on signup

**Solution:**
Verify `SUPABASE_ANON_KEY` in `frontend/assets/js/auth.js` matches:
https://supabase.com/dashboard/project/bjnjucwpwdzgsnqmpmff/settings/api

### Issue: User not created in public.user table

**Solution:**
1. Check trigger exists:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

2. If not found, re-run `auth_migration.sql`

### Issue: CHIP webhook returns error

**Solution:**
1. Check Edge Function logs:
   - https://supabase.com/dashboard/project/bjnjucwpwdzgsnqmpmff/functions/chip-payment-topup/logs
2. Verify secrets are set correctly
3. Test webhook manually:
```bash
curl -X POST https://bjnjucwpwdzgsnqmpmff.supabase.co/functions/v1/chip-payment-topup \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Issue: Login shows "account deactivated"

**Solution:**
```sql
UPDATE public.user
SET is_active = true
WHERE email = 'user@example.com';
```

### Issue: Payment succeeds but subscription not activated

**Solution:**
1. Check Edge Function logs for errors
2. Verify package exists:
```sql
SELECT * FROM public.packages WHERE id = 'PACKAGE_UUID';
```
3. Manually activate:
```sql
UPDATE public.user
SET
  subscription_status = 'active',
  subscription_start = NOW(),
  subscription_end = NOW() + INTERVAL '30 days',
  package_id = 'PACKAGE_UUID',
  max_devices = 1
WHERE email = 'user@example.com';
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  FRONTEND (HTML/JS)                  │
│                                                      │
│  ┌────────────┐  ┌──────────────────┐              │
│  │ index.html │  │ dashboard.html   │              │
│  │  auth.js   │  │ chip-payment.js  │              │
│  └────────────┘  └──────────────────┘              │
└──────────────────┬────────────────┬─────────────────┘
                   │                │
                   ▼                ▼
         ┌──────────────┐  ┌────────────────────┐
         │ Supabase     │  │ Supabase           │
         │ Auth         │  │ Edge Functions     │
         │              │  │                    │
         │ • signup     │  │ • get-email-from   │
         │ • login      │  │ • chip-payment     │
         │ • sessions   │  └────────┬───────────┘
         └──────┬───────┘           │
                │                   ▼
                │         ┌──────────────────────┐
                │         │ CHIP Payment Gateway │
                │         │ • Create payment     │
                │         │ • Webhook callback   │
                │         └──────────────────────┘
                │
                ▼
     ┌─────────────────────────────────────┐
     │     Supabase PostgreSQL Database     │
     │                                      │
     │  • auth.users    (Supabase managed) │
     │  • public.user   (your custom)      │
     │  • packages                          │
     │  • payments                          │
     │  • device_setting                    │
     └──────────────────────────────────────┘
```

---

## How It Works

### 1. User Signup Flow
```
User fills form
    ↓
auth.js calls supabase.auth.signUp()
    ↓
Supabase creates user in auth.users
    ↓
Trigger: on_auth_user_created fires
    ↓
Auto-creates profile in public.user
    ↓
Email confirmation sent
    ↓
User clicks link → account confirmed
```

### 2. User Login Flow
```
User enters email/phone/ID + password
    ↓
auth.js checks if identifier is email
    ↓
If NOT email → call get-email-from-user Edge Function
    ↓
Edge Function looks up email in public.user table
    ↓
auth.js calls supabase.auth.signInWithPassword()
    ↓
Check if user is_active = true
    ↓
If inactive → sign out + show error
    ↓
If active → redirect to dashboard
```

### 3. Payment Flow
```
User selects package
    ↓
Frontend calls chip-payment.js createPayment()
    ↓
Edge Function: chip-payment-topup
    ↓
Creates record in payments table
    ↓
Calls CHIP API to create purchase
    ↓
Returns checkout_url to frontend
    ↓
User redirected to CHIP checkout
    ↓
User completes payment
    ↓
CHIP sends webhook to Edge Function
    ↓
Edge Function verifies payment with CHIP API
    ↓
Updates payments table → status = 'paid'
    ↓
Updates user table → subscription_status = 'active'
    ↓
User can now use service
```

---

## Next Steps

1. **Customize Email Templates:**
   - Go to: https://supabase.com/dashboard/project/bjnjucwpwdzgsnqmpmff/auth/templates
   - Update branding and copy

2. **Add Password Reset:**
   - Implement "Forgot Password" link
   - Call `supabase.auth.resetPasswordForEmail()`

3. **Add Profile Page:**
   - Let users update full_name, phone
   - Change password

4. **Add Billing Page:**
   - Show current subscription
   - Payment history from `payments` table
   - Upgrade/downgrade options

5. **Add Device Management:**
   - Show current devices
   - Add new device (check max_devices limit)
   - Delete devices

---

## Support

- **Supabase Auth Docs:** https://supabase.com/docs/guides/auth
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **CHIP Developer Docs:** https://developer.chip-in.asia/

---

**Last Updated:** 2025-01-09
