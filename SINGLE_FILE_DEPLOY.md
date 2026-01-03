# Single File Deployment for Deno Playground

If you MUST deploy via Deno Deploy playground (web editor), you cannot use file imports because the playground only supports a single file.

## Problem

The current code structure uses multiple files:
```typescript
import { handleWebhook } from "./handlers/webhook.ts";  // ❌ Won't work in playground
```

## Solution Options

### Option 1: Use GitHub Integration (STRONGLY RECOMMENDED) ✅

1. Go to https://dash.deno.com/projects/pening-bot/settings
2. Find "Production" or "Git Integration"
3. Click "Link GitHub Repository"
4. Select: `aqilrvsb/dev-muse-automaton`
5. **Entry Point:** `deno-backend/main.ts`
6. Branch: `main`
7. Click "Deploy"

**This is the ONLY proper way to deploy a multi-file Deno project!**

---

### Option 2: Combine All Files (NOT RECOMMENDED)

If GitHub integration is absolutely not possible, you would need to:

1. Copy all handler code into main.ts
2. Copy all service code into main.ts
3. Remove all import statements
4. Make it one giant file (5000+ lines)

**This is VERY BAD practice and will be hard to maintain!**

---

## Why Your Current Approach Fails

When you paste only `main.ts` into Deno Deploy playground:

```typescript
// main.ts tries to import:
import { handleWebhook } from "./handlers/webhook.ts";

// But ./handlers/webhook.ts doesn't exist in playground!
// Error: Module not found 'file:///src/handlers/webhook.ts'
```

Deno Deploy playground is meant for **single-file demos**, not full applications.

---

## The Right Way: GitHub Integration

Your project structure:
```
dev-muse-automaton/
├── deno-backend/
│   ├── main.ts              ← Entry point
│   ├── handlers/            ← These need to be included
│   │   ├── webhook.ts
│   │   ├── auth.ts
│   │   └── ...
│   ├── services/            ← These need to be included
│   │   ├── flow-execution.ts
│   │   ├── debounce.ts
│   │   └── ...
│   └── utils/
└── ...
```

**Deno Deploy with GitHub Integration:**
- ✅ Clones entire `deno-backend` folder
- ✅ Resolves all imports automatically
- ✅ Updates on every git push
- ✅ Proper deployment for real projects

---

## Check Current Deployment Method

Go to: https://dash.deno.com/projects/pening-bot/settings

Look for:
- "Production" section
- "Deployment" section
- "Git Integration" section

**If you see:** "No linked repository"
→ You MUST link GitHub

**If you see:** Repository already linked
→ Just push your changes and it auto-deploys

---

## Verify Entry Point

After linking GitHub, make sure:

**Entry Point:** `deno-backend/main.ts`

NOT:
- ❌ `main.ts` (wrong - it's in a subdirectory)
- ❌ `/main.ts` (wrong)
- ❌ `./main.ts` (wrong)

CORRECT:
- ✅ `deno-backend/main.ts`

---

## Your Code is Ready!

Your code is already pushed to GitHub with all fixes:
- ✅ webhook_id → instance
- ✅ Prompt-based AI system
- ✅ All handler and service files

**Just link GitHub and deploy!** 🚀

---

## Summary

**DON'T:** Try to paste code file-by-file in playground ❌
**DO:** Link your GitHub repository ✅

The error you're seeing is because Deno Deploy can't find the imported files. GitHub integration solves this automatically.
