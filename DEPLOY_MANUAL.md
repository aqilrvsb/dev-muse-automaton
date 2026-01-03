# Manual Deployment Options

## ✅ CHANGES PUSHED TO GITHUB

Your code has been successfully committed and pushed to GitHub:
- Repository: https://github.com/aqilrvsb/dev-muse-automaton
- Commit: Fix webhook_id to instance field + prompt-based AI system

---

## Option 1: Auto-Deploy via GitHub (EASIEST ✅)

If your Deno Deploy project is connected to GitHub, it will auto-deploy automatically!

**Check GitHub Integration:**
1. Go to: https://dash.deno.com/projects/pening-bot/settings
2. Look for "GitHub Integration" section
3. If connected, it should show:
   - Repository: `aqilrvsb/dev-muse-automaton`
   - Branch: `main`
   - Entry point: `deno-backend/main.ts`

**If already connected:** Just wait 1-2 minutes for auto-deployment!

**If NOT connected:** Follow "Setup GitHub Integration" below.

---

## Option 2: Deploy via Deno Dashboard (MANUAL)

**Steps:**
1. Go to: https://dash.deno.com/projects/pening-bot
2. Click "Deploy" button (top right)
3. Select "GitHub Repository"
4. Choose: `aqilrvsb/dev-muse-automaton`
5. Branch: `main`
6. Entry point: `deno-backend/main.ts`
7. Click "Deploy"

---

## Option 3: Install deployctl (Command Line)

**Install deployctl:**
```bash
# Install Deno (if not installed)
iwr https://deno.land/install.ps1 -useb | iex

# Install deployctl
deno install -Arf https://deno.land/x/deploy/deployctl.ts
```

**Deploy:**
```bash
cd "C:\Users\User\Pictures\dev-muse-automaton-main\deno-backend"
deployctl deploy --project=pening-bot --prod main.ts
```

---

## Setup GitHub Integration (One-Time Setup)

If GitHub integration is not set up:

1. Go to: https://dash.deno.com/projects/pening-bot/settings
2. Scroll to "GitHub Integration"
3. Click "Link GitHub Repository"
4. Authorize Deno Deploy to access your GitHub
5. Select repository: `aqilrvsb/dev-muse-automaton`
6. Configure:
   - Branch: `main`
   - Entry point: `deno-backend/main.ts`
   - Production branch: `main`
7. Click "Link"

**Benefits:**
- ✅ Auto-deploy on every `git push`
- ✅ No manual deployment needed
- ✅ View deployment history
- ✅ Automatic rollbacks if deployment fails

---

## Verify Deployment

After deployment (via any method), verify it works:

### 1. Check Health Endpoint
```bash
curl https://pening-bot.deno.dev/health
```

Expected response:
```json
{"status":"ok","service":"dev-muse-automaton-deno"}
```

### 2. Check Logs
https://dash.deno.com/projects/pening-bot/logs

Look for:
```
✅ Debounce service initialized
🚀 Dev Muse Automaton Deno Backend Started!
📍 Supabase URL: https://bjnjucwpwdzgsnqmpmff.supabase.co
⏱️  Debounce delay: 4000ms
```

### 3. Test with Real WhatsApp Message
Send "Hello" from your WhatsApp to the bot.

Expected logs:
```
📥 Webhook: POST /FakhriAidilTLW-001/UserChatBot_FakhriAidilTLW-001
✅ Device found: FakhriAidilTLW-001 (Provider: waha)
📬 Message queued for debouncing (4s delay)
⏰ Timer EXPIRED! Processing 1 messages...
✅ Found prompt: [Your Prompt Name]
✅ New conversation created: 1
🤖 Generating AI response with prompt: [Your Prompt Name]
✅ WAHA message sent to 60179645043
```

---

## Environment Variables

Make sure these are set in Deno Deploy:
https://dash.deno.com/projects/pening-bot/settings

Required:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

Optional:
- `DEBOUNCE_DELAY_MS` (default: 4000)
- `SERVER_URL`

---

## Troubleshooting

### Deployment succeeds but still getting old code behavior:
- Clear Deno Deploy cache: Settings → Clear Cache
- Force redeploy: Push an empty commit
  ```bash
  git commit --allow-empty -m "Force redeploy"
  git push origin main
  ```

### "Device not found" error:
- Check database: `SELECT * FROM device_setting WHERE device_id = 'FakhriAidilTLW-001'`
- Verify `instance` field matches URL: `UserChatBot_FakhriAidilTLW-001`

### "No prompt configured" error:
- Check database: `SELECT * FROM prompts WHERE device_id = 'FakhriAidilTLW-001'`
- Create prompt via frontend Prompts page

---

## Current Status

✅ Code pushed to GitHub (commit 084ea20)
✅ All fixes applied:
  - webhook_id → instance field
  - device.id_device → device.device_id
  - Prompt-based AI system
  - Conversation history in conv_last/conv_current

🔄 Waiting for deployment...

**Next Step:** Choose one of the deployment options above!
