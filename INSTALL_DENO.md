# Install Deno and Deploy Manually

## Step 1: Install Deno

**For Windows (PowerShell):**
```powershell
irm https://deno.land/install.ps1 | iex
```

**Or download installer:**
https://github.com/denoland/deno/releases

After installation, restart your terminal and verify:
```bash
deno --version
```

## Step 2: Install deployctl

```bash
deno install -Arf --global https://deno.land/x/deploy/deployctl.ts
```

## Step 3: Login to Deno Deploy

```bash
deployctl login
```

This will open a browser for authentication.

## Step 4: Deploy Your Code

```bash
cd "C:\Users\User\Pictures\dev-muse-automaton-main\deno-backend"

deployctl deploy --project=pening-bot --prod --token=YOUR_ACCESS_TOKEN main.ts
```

**Get your access token:**
1. Go to https://dash.deno.com/account#access-tokens
2. Click "New Access Token"
3. Copy the token
4. Use it in the deploy command

## Step 5: Deploy Command

```bash
cd "C:\Users\User\Pictures\dev-muse-automaton-main\deno-backend"

deployctl deploy --project=pening-bot --prod main.ts
```

This will upload ALL files in the deno-backend directory to Deno Deploy.

---

## Alternative: Get Access Token

If login doesn't work, use access token directly:

1. Go to: https://dash.deno.com/account#access-tokens
2. Create new token
3. Copy the token (e.g., `ddp_xxxxxxxxxxxxx`)
4. Deploy with token:

```bash
deployctl deploy --project=pening-bot --prod --token=ddp_xxxxxxxxxxxxx main.ts
```

---

## What This Does

- Uploads `main.ts` and ALL imported files
- Uploads `handlers/*.ts`
- Uploads `services/*.ts`
- Uploads `utils/*.ts`
- Properly resolves all imports
- Deploys to production

This is the correct way to deploy a multi-file Deno project without using GitHub!
