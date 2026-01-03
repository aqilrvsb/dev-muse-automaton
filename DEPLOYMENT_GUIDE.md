# Dev Muse Automaton - Complete Deployment Guide

## 🎯 Overview

This guide covers the complete migration from Railway to **Vercel + Deno Deploy**.

### Architecture:
```
┌─────────────────────────────────────┐
│   Frontend (Vercel)                 │
│   - React + TypeScript + Vite       │
│   - Static CDN deployment           │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│   Backend (Deno Deploy)             │
│   - TypeScript/Deno                 │
│   - Serverless Functions            │
│   - Webhook Handler (GET + POST)    │
│   - Message Debouncing (4s)         │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│   Database (Supabase)               │
│   - PostgreSQL                      │
│   - Same database, no migration     │
└─────────────────────────────────────┘
```

---

## 📋 Prerequisites

1. **Accounts Required:**
   - Vercel account (https://vercel.com)
   - Deno Deploy account (https://dash.deno.com)
   - Supabase project (existing: `bjnjucwpwdzgsnqmpmff`)

2. **Required Keys:**
   - Supabase Anon Key (public)
   - Supabase Service Role Key (secret) ⚠️ **CRITICAL - MISSING**
   - JWT Secret (generate new for production)
   - Billplz API Key (optional, for payments)
   - OpenRouter API Key (for AI features)

---

## 🔑 Step 1: Get Missing Environment Variables

### 1.1 Get Supabase Service Role Key

**⚠️ CRITICAL - This is currently missing from Railway!**

1. Go to: https://supabase.com/dashboard/project/bjnjucwpwdzgsnqmpmff/settings/api
2. Scroll to **"Project API keys"**
3. Copy the `service_role` key (NOT the `anon` key)
4. **Keep this secret!** This bypasses Row Level Security.

### 1.2 Generate New JWT Secret

For production, generate a secure secret:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Or using OpenSSL
openssl rand -hex 64
```

### 1.3 Get OpenRouter API Key (for AI)

1. Go to: https://openrouter.ai/
2. Create account and get API key
3. This key allows access to OpenAI, Google Gemini, and other AI models

---

## 🚀 Step 2: Deploy Backend to Deno Deploy

### 2.1 Create New Deno Deploy Project

1. Go to: https://dash.deno.com/projects
2. Click **"New Project"**
3. Name: `dev-muse-automaton-backend`
4. Click **"Create Project"**

### 2.2 Set Environment Variables

In Deno Deploy project settings, add these environment variables:

```bash
# Supabase Configuration
SUPABASE_URL=https://bjnjucwpwdzgsnqmpmff.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqbmp1Y3dwd2R6Z3NucW1wbWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0OTk1MzksImV4cCI6MjA3NjA3NTUzOX0.vw1rOUqYWFkPNDwTdEgIfsCO9pyvTsFKaXHq3RcRTNU
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY_FROM_STEP_1.1>

# Security
JWT_SECRET=<YOUR_GENERATED_SECRET_FROM_STEP_1.2>

# Payment (Optional)
BILLPLZ_API_KEY=<your-billplz-api-key-if-you-have-one>
BILLPLZ_COLLECTION_ID=<your-collection-id>

# Debouncing
DEBOUNCE_DELAY_MS=4000

# Server URL (will be updated after deployment)
SERVER_URL=https://dev-muse-automaton-backend.deno.dev
```

### 2.3 Deploy Backend Code

**Option A: Via GitHub (Recommended)**

1. Push your code to GitHub:
   ```bash
   cd c:\Users\aqilz\Documents\dev-muse-automaton-main
   git add deno-backend/
   git commit -m "Add Deno Deploy backend"
   git push origin main
   ```

2. In Deno Deploy:
   - Click **"Deploy from GitHub"**
   - Select repository: `dev-muse-automaton`
   - Set production branch: `main`
   - Set entry point: `deno-backend/main.ts`
   - Click **"Link"**

**Option B: Via `deployctl` CLI**

1. Install deployctl:
   ```bash
   deno install --allow-all --no-check -r -f https://deno.land/x/deploy/deployctl.ts
   ```

2. Deploy:
   ```bash
   cd c:\Users\aqilz\Documents\dev-muse-automaton-main\deno-backend
   deployctl deploy --project=dev-muse-automaton-backend main.ts
   ```

### 2.4 Verify Deployment

1. Visit: `https://dev-muse-automaton-backend.deno.dev/health`
2. Should return:
   ```json
   {
     "status": "ok",
     "service": "dev-muse-automaton-deno"
   }
   ```

### 2.5 Get Your Deployment URL

Your backend URL will be:
```
https://dev-muse-automaton-backend.deno.dev
```

Or custom domain if you configure one.

---

## 🌐 Step 3: Deploy Frontend to Vercel

### 3.1 Create New Vercel Project

1. Go to: https://vercel.com/new
2. Import Git Repository
3. Select: `dev-muse-automaton` repository
4. Framework Preset: **Vite**
5. Root Directory: `./` (leave as root)

### 3.2 Configure Build Settings

- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### 3.3 Set Environment Variables

In Vercel project settings → Environment Variables, add:

```bash
# Supabase (Public)
VITE_SUPABASE_URL=https://bjnjucwpwdzgsnqmpmff.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqbmp1Y3dwd2R6Z3NucW1wbWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0OTk1MzksImV4cCI6MjA3NjA3NTUzOX0.vw1rOUqYWFkPNDwTdEgIfsCO9pyvTsFKaXHq3RcRTNU

# API URL (Your Deno Deploy backend)
VITE_API_URL=https://dev-muse-automaton-backend.deno.dev
```

**Important:** Make sure to set these for all environments (Production, Preview, Development).

### 3.4 Deploy

Click **"Deploy"** and wait for build to complete.

### 3.5 Verify Deployment

1. Visit your Vercel URL (e.g., `https://dev-muse-automaton.vercel.app`)
2. Try logging in
3. Check browser console for API calls to Deno Deploy

---

## 🔗 Step 4: Update WhatsApp Webhook URLs

### 4.1 New Webhook URL Format

Your new webhook URLs will be:
```
https://dev-muse-automaton-backend.deno.dev/{device_id}/{webhook_id}
```

Example:
```
https://dev-muse-automaton-backend.deno.dev/FakhriAidilTLW-001/UserChatBot_FakhriAidilTLW-001
```

### 4.2 Update WhatsApp Provider Settings

For each WhatsApp provider (WAHA, Wablas, WhCenter):

1. **Login to provider dashboard**
2. **Go to Webhook Settings**
3. **Update webhook URL** to new Deno Deploy URL
4. **Verify webhook** (providers will send GET request with `hub.challenge`)
5. **Test** by sending a test message

### 4.3 Webhook Verification

The Deno backend automatically handles both:
- **GET** requests (webhook verification)
- **POST** requests (actual messages)

No additional configuration needed!

---

## ✅ Step 5: Testing

### 5.1 Test Authentication

1. Go to frontend URL
2. Try registering a new user
3. Try logging in
4. Check dashboard loads

### 5.2 Test WhatsApp Integration

1. Create a device in Device Settings
2. Configure WhatsApp provider (WAHA/Wablas/WhCenter)
3. Set webhook URL to: `https://dev-muse-automaton-backend.deno.dev/{device_id}/{webhook_id}`
4. Send test message to WhatsApp number
5. Check message is received and processed
6. Verify 4-second debouncing works

### 5.3 Test Flow Builder

1. Create a new flow
2. Add nodes (Start → Message → AI → End)
3. Save flow
4. Send WhatsApp message
5. Verify flow executes correctly

### 5.4 Test AI Responses

1. Make sure device has AI API key configured
2. Create flow with AI node
3. Send message
4. Verify AI response is generated and sent

---

## 🗑️ Step 6: Cleanup Railway (After Everything Works)

**⚠️ Only do this after confirming everything works on Vercel + Deno Deploy!**

1. Go to Railway dashboard
2. Select `chatbot-automation-production` project
3. Click **Settings** → **Delete Project**
4. Confirm deletion

This will stop billing from Railway.

---

## 📊 Cost Comparison

### Before (Railway):
- **Railway:** ~$5-20/month (depending on usage)

### After (Vercel + Deno Deploy):
- **Vercel (Frontend):** FREE (Hobby plan)
- **Deno Deploy (Backend):** FREE tier includes:
  - 100,000 requests/day
  - 100 GiB data transfer/month
  - 10ms CPU time/request
- **Supabase:** FREE tier (existing)

**Total:** $0/month (within free tiers) 🎉

---

## 🔧 Troubleshooting

### Issue: 401 Unauthorized on API Calls

**Solution:**
1. Check `SUPABASE_SERVICE_ROLE_KEY` is set in Deno Deploy
2. Verify it's the correct key from Supabase dashboard
3. Check JWT_SECRET is set

### Issue: Webhook Not Receiving Messages

**Solution:**
1. Verify webhook URL format: `https://backend.deno.dev/{device_id}/{webhook_id}`
2. Check device exists in database with matching `device_id` and `webhook_id`
3. Test webhook verification (GET request should return 200)
4. Check Deno Deploy logs for errors

### Issue: Frontend Shows "Failed to fetch"

**Solution:**
1. Check `VITE_API_URL` is set correctly in Vercel
2. Verify Deno Deploy backend is running (visit `/health` endpoint)
3. Check browser console for CORS errors
4. Ensure Deno backend has CORS headers enabled (already configured)

### Issue: AI Responses Not Working

**Solution:**
1. Check device has `api_key` configured in `device_setting` table
2. Verify `api_key_option` is set (e.g., "openai/gpt-4.1")
3. Test API key directly with OpenRouter
4. Check Deno Deploy logs for AI API errors

### Issue: Debouncing Not Working

**Solution:**
1. Check Deno KV is enabled (automatic on Deno Deploy)
2. Verify `DEBOUNCE_DELAY_MS` is set (default: 4000)
3. Check logs for "Message queued for debouncing"
4. Test by sending multiple messages quickly

---

## 🔒 Security Checklist

- ✅ `SUPABASE_SERVICE_ROLE_KEY` is set in Deno Deploy (NOT in frontend)
- ✅ `JWT_SECRET` is unique and not the default fallback value
- ✅ `VITE_SUPABASE_ANON_KEY` is the anon key (NOT service role key)
- ✅ API keys are not committed to Git
- ✅ CORS headers allow only necessary origins
- ✅ JWT tokens expire after 7 days
- ✅ User authentication required for all sensitive endpoints

---

## 📚 Additional Resources

- **Vercel Docs:** https://vercel.com/docs
- **Deno Deploy Docs:** https://docs.deno.com/deploy/manual
- **Supabase Docs:** https://supabase.com/docs
- **OpenRouter Docs:** https://openrouter.ai/docs

---

## 🆘 Support

If you encounter issues:

1. Check Deno Deploy logs: https://dash.deno.com/projects/dev-muse-automaton-backend/logs
2. Check Vercel deployment logs: https://vercel.com/your-username/dev-muse-automaton/deployments
3. Check browser console for frontend errors
4. Review this guide for missed steps

---

## 🎉 Success Checklist

- [ ] Backend deployed to Deno Deploy
- [ ] Frontend deployed to Vercel
- [ ] All environment variables configured
- [ ] Health check returns 200 OK
- [ ] Can login to frontend
- [ ] WhatsApp webhooks receiving messages
- [ ] Message debouncing works (4 seconds)
- [ ] Flow execution works
- [ ] AI responses generate correctly
- [ ] Railway project deleted (after everything works)

**When all checkboxes are complete, your migration is successful!** 🚀
