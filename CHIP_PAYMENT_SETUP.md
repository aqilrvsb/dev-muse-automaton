# CHIP Payment Gateway Integration Guide

Complete guide for implementing CHIP payment gateway in PeningBot for subscription management.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Database Setup](#database-setup)
4. [Edge Function Deployment](#edge-function-deployment)
5. [Environment Variables](#environment-variables)
6. [Frontend Integration](#frontend-integration)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This integration replaces Billplz with CHIP Payment Gateway for handling subscription payments in PeningBot. The system uses:

- **Supabase Edge Functions** for payment processing (not backend server)
- **CHIP Payment Gateway** for payment processing
- **PostgreSQL** for storing subscriptions and payment records
- **Webhook verification** for secure payment confirmation

### Architecture Flow

```
User selects package
  → Frontend calls Edge Function
  → Edge Function creates CHIP purchase
  → User redirected to CHIP payment page
  → User completes payment
  → CHIP sends webhook to Edge Function
  → Edge Function verifies with CHIP API
  → Edge Function activates subscription
  → User redirected back to app
```

---

## Prerequisites

### 1. CHIP Account Setup

1. Sign up at [https://www.chip-in.asia](https://www.chip-in.asia)
2. Complete business verification
3. Get your API credentials:
   - **Brand ID**: Found in Settings > Brand Settings
   - **API Key**: Found in Settings > Developer Settings

### 2. Supabase Project

- Active Supabase project
- Database access
- Edge Functions enabled

---

## Database Setup

### Step 1: Run the SQL Schema

Execute the SQL file in Supabase SQL Editor:

```bash
supabase/chip_payment_schema.sql
```

This creates:
- `packages` table - Subscription plans
- `payments` table - Payment records
- User subscription fields
- Helper functions
- Row Level Security (RLS) policies

### Step 2: Verify Tables

Check that these tables exist:

```sql
SELECT * FROM packages;
SELECT * FROM payments LIMIT 5;
```

### Step 3: Insert Default Packages

The schema automatically inserts 3 default packages:
- **Starter** - RM 29/month - 1 device
- **Pro** - RM 99/month - 5 devices
- **Enterprise** - RM 299/month - 20 devices

Customize these by updating the SQL INSERT statement or via Supabase dashboard.

---

## Edge Function Deployment

### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

### Step 3: Link Your Project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

To find your project ref:
- Go to Supabase Dashboard
- Settings > General
- Copy "Reference ID"

### Step 4: Deploy Edge Function

```bash
cd c:\Users\aqilz\Documents\dev-muse-automaton-main
supabase functions deploy chip-payment-topup
```

### Step 5: Verify Deployment

Check deployment at:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/chip-payment-topup
```

You should see:
```json
{
  "status": "ok",
  "message": "CHIP webhook endpoint ready"
}
```

---

## Environment Variables

### Supabase Edge Function Secrets

Set these environment variables in Supabase:

```bash
# Set CHIP API Key
supabase secrets set CHIP_API_KEY=your_chip_api_key_here

# Set CHIP Brand ID
supabase secrets set CHIP_BRAND_ID=your_chip_brand_id_here

# Set App Origin (your frontend URL)
supabase secrets set APP_ORIGIN=https://peningbot.vercel.app
```

Or via Supabase Dashboard:
1. Go to Edge Functions
2. Select `chip-payment-topup`
3. Go to "Secrets" tab
4. Add each secret

### Required Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `CHIP_API_KEY` | Your CHIP API key | `pk_live_abc123...` |
| `CHIP_BRAND_ID` | Your CHIP Brand ID | `brand_abc123` |
| `APP_ORIGIN` | Your frontend URL | `https://peningbot.vercel.app` |

### How to Find CHIP Credentials

**API Key:**
1. Login to CHIP Dashboard
2. Go to Settings → Developer
3. Copy "Secret Key" or "Public Key" (use Secret for backend)

**Brand ID:**
1. Login to CHIP Dashboard
2. Go to Settings → Brand Settings
3. Copy "Brand ID"

---

## CHIP Webhook Configuration

### Step 1: Get Edge Function URL

Your webhook URL is:
```
https://bjnjucwpwdzgsnqmpmff.supabase.co/functions/v1/chip-payment-topup
```

Replace `bjnjucwpwdzgsnqmpmff` with your Supabase project ref.

### Step 2: Configure in CHIP Dashboard

1. Login to CHIP Dashboard
2. Go to Settings → Webhooks
3. Add new webhook:
   - **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/chip-payment-topup`
   - **Events**: Select all purchase events
   - **Method**: POST
4. Save webhook

### Step 3: Test Webhook

CHIP will send a test webhook. Check Supabase Edge Function logs:

```bash
supabase functions logs chip-payment-topup
```

You should see:
```
🔔 CHIP Webhook received: {...}
```

---

## Frontend Integration

### Step 1: Update Packages Page

The existing `packages.html` is for admin. For user-facing subscription, use this structure:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Subscribe - PeningBot</title>
</head>
<body>
    <div id="packagesContainer"></div>

    <script type="module" src="/assets/js/chip-payment.js"></script>
    <script type="module">
        import * as ChipPayment from '/assets/js/chip-payment.js';

        async function init() {
            const user = await ChipPayment.initPaymentSystem();
            const packages = await ChipPayment.getActivePackages();
            displayPackages(packages);
        }

        async function subscribe(packageId, amount, name) {
            try {
                const result = await ChipPayment.initiatePayment(packageId, amount, name);
                // Redirect to CHIP payment page
                window.location.href = result.payment_url;
            } catch (error) {
                alert('Payment failed: ' + error.message);
            }
        }

        init();
    </script>
</body>
</html>
```

### Step 2: Handle Payment Redirects

After payment, users are redirected back to your app with status:

```javascript
const urlParams = new URLSearchParams(window.location.search);
const status = urlParams.get('status');

if (status === 'success') {
    // Show success message
    alert('Payment successful! Your subscription is now active.');
} else if (status === 'failed') {
    // Show error message
    alert('Payment failed. Please try again.');
}
```

### Step 3: Display Current Subscription

```javascript
import * as ChipPayment from '/assets/js/chip-payment.js';

const subscription = await ChipPayment.getCurrentSubscription(userId);

if (subscription.subscription_status === 'active') {
    console.log('Plan:', subscription.packages.name);
    console.log('Expires:', subscription.subscription_end);
    console.log('Max Devices:', subscription.max_devices);
}
```

---

## Testing

### 1. Test Payment Flow

1. Go to packages page
2. Click "Subscribe" on any package
3. You'll be redirected to CHIP payment page
4. Use CHIP test card:
   - Card: `4111 1111 1111 1111`
   - Expiry: Any future date
   - CVV: `123`
5. Complete payment
6. You'll be redirected back with `?status=success`
7. Check database:
   ```sql
   SELECT * FROM payments ORDER BY created_at DESC LIMIT 1;
   SELECT * FROM users WHERE id = 'your_user_id';
   ```

### 2. Test Webhook

1. Make a test payment
2. Check Edge Function logs:
   ```bash
   supabase functions logs chip-payment-topup --tail
   ```
3. You should see:
   ```
   📋 Webhook for Purchase xxx - Status: paid
   ✅ Subscription activated for user xxx
   ```

### 3. Test Device Limit

```javascript
const result = await ChipPayment.canAddDevice(userId);
console.log('Can add device:', result.allowed);
console.log('Current:', result.current, '/', result.max);
```

---

## Troubleshooting

### Issue: "CHIP API Error 401"

**Cause**: Invalid API key

**Solution**:
1. Check CHIP_API_KEY is set correctly:
   ```bash
   supabase secrets list
   ```
2. Verify API key in CHIP Dashboard
3. Re-deploy function:
   ```bash
   supabase functions deploy chip-payment-topup
   ```

### Issue: "No payment URL received"

**Cause**: Edge function failed to create purchase

**Solution**:
1. Check logs:
   ```bash
   supabase functions logs chip-payment-topup
   ```
2. Verify Brand ID is correct
3. Check package exists in database

### Issue: "Webhook not received"

**Cause**: Webhook URL not configured or incorrect

**Solution**:
1. Verify webhook URL in CHIP Dashboard
2. Check Edge Function URL is accessible
3. Test webhook manually:
   ```bash
   curl -X GET https://YOUR_PROJECT_REF.supabase.co/functions/v1/chip-payment-topup
   ```

### Issue: "Subscription not activated"

**Cause**: Webhook processed but subscription not updated

**Solution**:
1. Check payment status in database:
   ```sql
   SELECT * FROM payments WHERE user_id = 'xxx' ORDER BY created_at DESC;
   ```
2. Check logs for errors:
   ```bash
   supabase functions logs chip-payment-topup --tail
   ```
3. Manually activate if needed:
   ```sql
   UPDATE users
   SET
     subscription_status = 'active',
     package_id = 'package_id',
     subscription_start = NOW(),
     subscription_end = NOW() + INTERVAL '30 days',
     max_devices = 5
   WHERE id = 'user_id';
   ```

### Issue: "CORS error"

**Cause**: CORS headers not set

**Solution**: Edge function already has CORS headers. If issue persists:
1. Check browser console for exact error
2. Verify request origin matches APP_ORIGIN
3. Add your domain to Supabase CORS settings

---

## Payment Status Flow

```
pending → paid → (subscription activated)
        → failed → (user notified)
        → refunded → (subscription deactivated)
```

### Webhook Event Types

CHIP sends these events:
- `purchase.created` - Purchase created
- `purchase.paid` - Payment successful ✅
- `purchase.failed` - Payment failed
- `purchase.cancelled` - User cancelled
- `purchase.refunded` - Payment refunded

Only `purchase.paid` activates subscription.

---

## Security Notes

1. **API Key Security**: Never expose CHIP_API_KEY in frontend
2. **Webhook Verification**: Always verify webhook with CHIP API (already implemented)
3. **Double-processing Prevention**: Check payment status before activating (already implemented)
4. **RLS Policies**: Users can only see their own payments (already configured)

---

## Migration from Billplz

If migrating from Billplz:

1. Keep existing payment records
2. Add new CHIP columns to payments table:
   ```sql
   ALTER TABLE payments ADD COLUMN chip_purchase_id VARCHAR(255);
   ALTER TABLE payments ADD COLUMN chip_transaction_id VARCHAR(255);
   ```
3. Update frontend to use new Chip Payment function
4. Test thoroughly before disabling Billplz
5. Gradually migrate users to CHIP

---

## Support

For CHIP-related issues:
- CHIP Documentation: https://developer.chip-in.asia
- CHIP Support: support@chip-in.asia

For Supabase Edge Functions:
- Supabase Docs: https://supabase.com/docs/guides/functions
- Supabase Discord: https://discord.supabase.com

---

## Summary Checklist

- [ ] CHIP account created and verified
- [ ] API credentials obtained (Brand ID + API Key)
- [ ] Database schema deployed
- [ ] Default packages inserted
- [ ] Edge function deployed
- [ ] Environment variables set (CHIP_API_KEY, CHIP_BRAND_ID, APP_ORIGIN)
- [ ] Webhook URL configured in CHIP Dashboard
- [ ] Frontend integration completed
- [ ] Test payment successful
- [ ] Webhook received and processed
- [ ] Subscription activated correctly

---

**Your CHIP payment integration is now complete!** 🎉

Users can now subscribe to packages and pay via CHIP Payment Gateway through Supabase Edge Functions.
