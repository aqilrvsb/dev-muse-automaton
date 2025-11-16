# 🚀 Quick Start - Deploy to Deno Deploy

Since you already have a Deno Deploy project at **https://pening-bot.deno.dev**, here's how to deploy the new backend:

## Step 1: Set Environment Variables in Deno Deploy

Go to: https://dash.deno.com/projects/pening-bot/settings

Add these environment variables:

```bash
SUPABASE_URL=https://bjnjucwpwdzgsnqmpmff.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqbmp1Y3dwd2R6Z3NucW1wbWZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0OTk1MzksImV4cCI6MjA3NjA3NTUzOX0.vw1rOUqYWFkPNDwTdEgIfsCO9pyvTsFKaXHq3RcRTNU
SUPABASE_SERVICE_ROLE_KEY=<GET_FROM_SUPABASE_DASHBOARD>
JWT_SECRET=<GENERATE_NEW_SECRET>
DEBOUNCE_DELAY_MS=4000
SERVER_URL=https://pening-bot.deno.dev
```

## Step 2: Get Missing Keys

### Get SUPABASE_SERVICE_ROLE_KEY:
1. Go to: https://supabase.com/dashboard/project/bjnjucwpwdzgsnqmpmff/settings/api
2. Copy the **service_role** secret key

### Generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Step 3: Deploy to Deno Deploy

### Option A: Using `deployctl` (Quick)

```bash
cd c:\Users\aqilz\Documents\dev-muse-automaton-main\deno-backend
deployctl deploy --project=pening-bot main.ts
```

### Option B: Via GitHub Integration

1. Push code to GitHub:
   ```bash
   cd c:\Users\aqilz\Documents\dev-muse-automaton-main
   git add .
   git commit -m "Add complete Deno backend"
   git push
   ```

2. In Deno Deploy dashboard:
   - Go to: https://dash.deno.com/projects/pening-bot
   - Click **"Settings"** → **"Git Integration"**
   - Connect to your GitHub repo
   - Set entry point: `deno-backend/main.ts`
   - Deploy!

## Step 4: Test Your Backend

Visit: https://pening-bot.deno.dev/health

Should return:
```json
{
  "status": "ok",
  "service": "dev-muse-automaton-deno"
}
```

## Step 5: Update WhatsApp Webhook URLs

Your new webhook format:
```
https://pening-bot.deno.dev/{device_id}/{webhook_id}
```

Example:
```
https://pening-bot.deno.dev/FakhriAidilTLW-001/UserChatBot_FakhriAidilTLW-001
```

Update this in your WhatsApp provider dashboard.

## Step 6: Deploy Frontend to Vercel

1. Go to: https://vercel.com/new
2. Import your GitHub repo
3. Set environment variables:
   ```
   VITE_SUPABASE_URL=https://bjnjucwpwdzgsnqmpmff.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   VITE_API_URL=https://pening-bot.deno.dev
   ```
4. Deploy!

## Done! 🎉

Your system is now running on:
- **Frontend:** Vercel (free)
- **Backend:** Deno Deploy (free)
- **Database:** Supabase (existing)

Total cost: **$0/month** ✨

---

## Testing Checklist

- [ ] Backend health check returns 200
- [ ] Can login to frontend
- [ ] WhatsApp webhook receives messages (both GET and POST)
- [ ] 4-second debouncing works
- [ ] Flow execution works
- [ ] AI responses generate

All good? You can now delete your Railway project to stop paying! 💰
