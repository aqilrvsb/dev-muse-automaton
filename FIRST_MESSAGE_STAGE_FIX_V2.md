# First Message Stage Fix V2 - Strengthened Instructions

## 🐛 The Problem (Still Occurring)

Even after the first fix, the AI was **STILL skipping the Welcome Message** stage on first customer contact.

### Real Example:
```
Customer's FIRST message: "Hai, nak tanye blh?"
(Translation: "Hi, can I ask?")

AI Response: ❌ "Stage": "Create Urgency with Promotions"
Expected: ✅ "Stage": "Welcome Message"
```

**Why this is wrong**:
- "Hai, nak tanye blh?" is a **general greeting**
- Customer is NOT asking about packages or pricing
- Customer is NOT asking for promotions
- This should trigger the **Welcome Message** stage, not skip ahead

---

## 🔍 Root Cause

The first fix (V1) added a warning, but it wasn't **strong enough**. The AI models (especially GPT-3.5 and even GPT-4) were still making their own decisions about which stage to use based on the conversation content, rather than strictly following the "first message = first stage" rule.

### Why AI Ignored the V1 Instructions:
1. The warning was there, but not emphatic enough
2. No explicit examples of what constitutes a "general greeting"
3. No forbidden list of stages to avoid
4. The AI was trying to be "helpful" by jumping to what it thought the customer wanted

---

## ✅ The Solution (V2 - Strengthened)

Completely **overhauled the first message instructions** to be:
- ✅ More emphatic (triple alert 🚨🚨🚨)
- ✅ More specific (numbered rules)
- ✅ More explicit (examples of greetings)
- ✅ More restrictive (forbidden list)
- ✅ Placed in TWO locations (context section + rules section)

---

## 🔧 Changes Made

### 1. Strengthened CURRENT CONTEXT Section (Lines 571-586)

**Before (V1 - Weak)**:
```typescript
${!currentStage ? `
🚨 THIS IS THE FIRST MESSAGE FROM CUSTOMER 🚨
- You MUST use: "Stage": "${stages[0] || 'Welcome Message'}"
- Do NOT skip stages or jump ahead
- Follow the exact script for the first stage
- Do NOT use "Create Urgency" or any other stage
` : `...`}
```

**After (V2 - Strong)**:
```typescript
${!currentStage ? `
🚨🚨🚨 CRITICAL: THIS IS THE FIRST MESSAGE FROM CUSTOMER 🚨🚨🚨

MANDATORY RULES FOR FIRST MESSAGE:
1. You MUST ALWAYS use "Stage": "${stages[0] || 'Welcome Message'}" for first contact
2. NEVER skip to other stages like "Create Urgency", "Promotions", or "Collect Details"
3. Even if customer says "hai", "hello", "nak tanye" - still use first stage ONLY
4. ONLY skip first stage if customer EXPLICITLY asks about pricing/packages in their FIRST message (e.g., "Berapa harga?", "Ada pakej apa?")
5. General greetings like "Hai", "Nak tanye blh?", "Hello" = USE FIRST STAGE "${stages[0] || 'Welcome Message'}"

⛔ FORBIDDEN for first message:
- "Create Urgency with Promotions" ❌
- "Dapat Detail" ❌
- "Collect Details" ❌
- Any stage OTHER than "${stages[0] || 'Welcome Message'}" ❌
` : `...`}
```

### 2. Added First Message Rule to STAGE FIELD (Lines 613-618)

**Before**:
```typescript
2. **STAGE FIELD** (MANDATORY):
   - "Stage" field MUST match EXACTLY one of: ${stages.map(s => `"${s}"`).join(', ')}
   - If current stage is null or unclear, use: "${stages[0] || 'First Stage'}"
   - Detect next appropriate stage based on user's response
```

**After**:
```typescript
2. **STAGE FIELD** (MANDATORY):
   - "Stage" field MUST match EXACTLY one of: ${stages.map(s => `"${s}"`).join(', ')}
   - ⚠️ FIRST MESSAGE RULE: If this is customer's FIRST message (no previous conversation), you MUST use "${stages[0] || 'Welcome Message'}" unless they explicitly ask about pricing/packages
   - General greetings ("Hai", "Hello", "Nak tanye") on FIRST contact = ALWAYS use first stage
   - For ongoing conversations: Progress to next stage based on customer's response
   - Follow sequential stage flow
```

---

## 📊 How It Works Now

### Example 1: General Greeting (First Contact)
```
Customer: "Hai, nak tanye blh?"
Current Stage: null (first message)
```

**System Prompt Shows**:
```
🚨🚨🚨 CRITICAL: THIS IS THE FIRST MESSAGE FROM CUSTOMER 🚨🚨🚨

MANDATORY RULES FOR FIRST MESSAGE:
1. You MUST ALWAYS use "Stage": "Welcome Message" for first contact
2. NEVER skip to other stages like "Create Urgency", "Promotions", or "Collect Details"
3. Even if customer says "hai", "hello", "nak tanye" - still use first stage ONLY
...
```

**AI Response**:
```json
{
  "Stage": "Welcome Message",  ✅ CORRECT!
  "Response": [
    {"type": "text", "content": "Hi! Terima kasih kerana menghubungi kami..."}
  ]
}
```

---

### Example 2: Explicit Pricing Question (First Contact - Exception)
```
Customer: "Berapa harga pakej?"
Current Stage: null (first message)
```

**System Prompt Shows**:
```
...
4. ONLY skip first stage if customer EXPLICITLY asks about pricing/packages in their FIRST message (e.g., "Berapa harga?", "Ada pakej apa?")
...
```

**AI Response**:
```json
{
  "Stage": "Create Urgency with Promotions",  ✅ CORRECT! (Exception allowed)
  "Response": [
    {"type": "text", "content": "Hai kak! PROMO JIMAT BERGANDA..."}
  ]
}
```

---

### Example 3: Ongoing Conversation
```
Customer: "Ok boleh, nak tahu lebih lanjut"
Current Stage: "Welcome Message"
```

**System Prompt Shows**:
```
📍 Continue from stage: "Welcome Message"
- Progress to next stage only if customer's response indicates they're ready
- Follow the stage flow sequentially
- Don't skip stages unless customer explicitly requests specific information
```

**AI Response**:
```json
{
  "Stage": "Introduction",  ✅ CORRECT! (Progressing sequentially)
  "Response": [...]
}
```

---

## 🎯 Key Improvements

### V1 → V2 Comparison:

| Feature | V1 (Weak) | V2 (Strong) |
|---------|-----------|-------------|
| **Alert Level** | 🚨 Single | 🚨🚨🚨 Triple |
| **Format** | Bullet points | Numbered mandatory rules |
| **Examples** | Generic | Specific ("Hai", "Nak tanye blh?") |
| **Forbidden List** | Mentioned in text | Explicit ❌ list |
| **Placement** | Context section only | Context + Rules section |
| **Exception Clarity** | Vague | Explicit examples given |

---

## 📁 Files Changed

### Production:
- ✅ `deno-backend/complete-webhook-single-file.ts`
  - Lines 571-591: Strengthened CURRENT CONTEXT section
  - Lines 613-618: Added FIRST MESSAGE RULE to STAGE FIELD

### Development:
- ✅ `deno-backend/services/ai.ts`
  - Lines 177-197: Strengthened CURRENT CONTEXT section
  - Lines 221-226: Added FIRST MESSAGE RULE to STAGE FIELD

---

## 🧪 Testing

### Test Case 1: General Greeting
```
1. Clear conversation: DELETE FROM ai_whatsapp WHERE prospect_num = '+60123'
2. Send: "Hai, nak tanye blh?"
3. Expected Stage: "Welcome Message" ✅
4. Should NOT be: "Create Urgency with Promotions" ❌
```

### Test Case 2: Another General Greeting
```
1. Clear conversation
2. Send: "Hello"
3. Expected Stage: "Welcome Message" ✅
```

### Test Case 3: Explicit Pricing Question (Exception)
```
1. Clear conversation
2. Send: "Berapa harga pakej?"
3. Expected Stage: Can be "Create Urgency with Promotions" or "Introduction" ✅ (Exception allowed)
```

### Test Case 4: Vague Question
```
1. Clear conversation
2. Send: "Nak tanye sikit"
3. Expected Stage: "Welcome Message" ✅ (Not explicit pricing question)
```

---

## ⚠️ Important Notes

### What Counts as "Explicit Pricing Question"?
- ✅ "Berapa harga?" (How much?)
- ✅ "Ada pakej apa?" (What packages?)
- ✅ "Harga berapa?" (Price?)
- ✅ "Nak tahu harga" (Want to know price)

### What Counts as "General Greeting"?
- ✅ "Hai" / "Hi" / "Hello"
- ✅ "Nak tanye" (Want to ask)
- ✅ "Nak tanye blh?" (Can I ask?)
- ✅ "Boleh tanya?" (Can ask?)
- ✅ "Ada?" (There?)

### When to Use First Stage:
- Always use first stage for general greetings
- Always use first stage when customer's intent is unclear
- **Only skip** if customer EXPLICITLY mentions pricing/packages in FIRST message

---

## 🐞 Troubleshooting

### Problem: AI still skips to "Create Urgency" on "Hai, nak tanye blh?"

**Diagnosis**:
1. Check Deno logs - does it show the CRITICAL warning?
   ```
   Look for: "🚨🚨🚨 CRITICAL: THIS IS THE FIRST MESSAGE FROM CUSTOMER 🚨🚨🚨"
   ```

2. Check AI model being used:
   ```sql
   SELECT api_key_option FROM device_setting WHERE device_id = 'XXX';
   ```

**Solutions**:
- If using GPT-3.5 → Upgrade to GPT-4 (better instruction following)
- If warning doesn't appear → System prompt not building correctly
- If warning appears but AI ignores → Model may be too "creative", try with lower temperature (0.3 instead of 0.7)

### Problem: AI won't skip even when customer asks "Berapa harga?"

**This is actually CORRECT behavior if**:
- Your prompt's first stage includes pricing information
- The Welcome Message stage is designed to handle pricing questions

**This is WRONG if**:
- Customer explicitly asks about pricing but gets generic welcome

**Solution**: Adjust rule #4 in your specific prompt to be more permissive for your use case.

---

## 📚 Related Documentation

- [STAGE_FLOW_FIX.md](./STAGE_FLOW_FIX.md) - Original V1 fix
- [ALL_FIXES_SUMMARY.md](./ALL_FIXES_SUMMARY.md) - Complete overview
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Testing guide

---

**Status**: ✅ Fixed V2 - MUCH Stronger Instructions
**Date**: 2025-01-17
**Breaking Changes**: None
**Deployment**: Ready for Deno Deploy
**Upgrade from V1**: Recommended - much better first message detection
