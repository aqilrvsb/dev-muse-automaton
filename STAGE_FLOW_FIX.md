# Stage Flow Fix - First Message Handling

## 🐛 The Problem

When a customer sends their first message (e.g., "Hai"), the AI was **skipping the Welcome Message stage** and jumping directly to "Create Urgency with Promotions" or other stages.

### Example of Broken Behavior:

**Customer sends**:
```
Hai
Nak tanye sikit blh?
```

**AI incorrectly responds with**:
```json
{
  "Stage": "Create Urgency with Promotions",
  "Response": [
    {"type": "text", "content": "Hai kak!🔥 PROMO JIMAT BERGANDA..."},
    {"type": "image", "content": "https://automation.../promo1.jpg"}
  ]
}
```

**Expected behavior**: Should start with "Welcome Message" stage first.

---

## 🔍 Root Cause

When `currentStage` is `null` (indicating the first message from a customer), the system prompt didn't provide **explicit enough instructions** to force the AI to use the first stage from the stages array.

The AI model was making its own decision about which stage to use based on the conversation content, rather than following the sequential stage flow.

---

## ✅ The Solution

Updated `buildDynamicSystemPrompt()` function in `complete-webhook-single-file.ts` (lines 565-581) to add **conditional instructions** based on whether `currentStage` is null or not.

### Code Changes:

```typescript
### CURRENT CONTEXT:
- Current Stage: ${currentStage || stages[0] || 'First Stage'}
- Available Stages: ${stages.map((s, i) => `${i + 1}. ${s}`).join(', ')}
- Previous Conversation:
${conversationHistory || 'No previous conversation - this is the FIRST message'}

${!currentStage ? `
🚨 THIS IS THE FIRST MESSAGE FROM CUSTOMER 🚨
- You MUST use: "Stage": "${stages[0] || 'Welcome Message'}"
- Do NOT skip stages or jump ahead
- Follow the exact script for the first stage
- Do NOT use "Create Urgency" or any other stage
` : `
📍 Continue from stage: "${currentStage}"
- Progress to next stage only if customer's response matches the intent
- Follow the stage flow sequentially
`}
```

### What This Does:

1. **When `currentStage` is null (first message)**:
   - Shows big warning: "🚨 THIS IS THE FIRST MESSAGE FROM CUSTOMER 🚨"
   - Explicitly tells AI to use the first stage from stages array
   - Forbids skipping or jumping ahead
   - Prevents using any other stage

2. **When `currentStage` has a value (ongoing conversation)**:
   - Shows current stage
   - Tells AI to progress sequentially
   - Only move to next stage if customer's response matches the intent

---

## 📊 How It Works Now

### First Message Flow:

```
1. Customer sends first message: "Hai"
   ↓
2. System detects currentStage = null
   ↓
3. buildDynamicSystemPrompt() adds explicit instructions:
   "🚨 THIS IS THE FIRST MESSAGE FROM CUSTOMER 🚨
    You MUST use: 'Stage': 'Welcome Message'"
   ↓
4. AI generates response with Stage: "Welcome Message"
   ↓
5. System saves stage to ai_whatsapp.stage
   ↓
6. Customer receives welcome message
```

### Subsequent Message Flow:

```
1. Customer sends message: "Ok berapa harga?"
   ↓
2. System detects currentStage = "Welcome Message"
   ↓
3. buildDynamicSystemPrompt() adds:
   "📍 Continue from stage: 'Welcome Message'
    Progress to next stage only if customer's response matches the intent"
   ↓
4. AI analyzes customer asked about pricing → moves to next appropriate stage
   ↓
5. AI generates response with new stage (e.g., "Introduction")
   ↓
6. System saves new stage to ai_whatsapp.stage
```

---

## 🎯 Key Features

### 1. **Explicit First Stage Enforcement**
- No ambiguity about which stage to use for first message
- AI cannot skip or jump ahead on first contact

### 2. **Sequential Stage Progression**
- Stages progress in order defined in user's prompt
- AI only moves to next stage when customer's response indicates readiness

### 3. **Context-Aware Instructions**
- Different instructions for first message vs. ongoing conversation
- Maintains conversation flow consistency

### 4. **Numbered Stage List**
- Available stages shown with numbers (1. Welcome Message, 2. Introduction, etc.)
- Makes it clearer which stage is "first"

---

## 🧪 Testing

To verify the fix works:

1. **Clear existing conversation** (or use new phone number):
   ```sql
   DELETE FROM ai_whatsapp WHERE prospect_num = '+60123456789';
   ```

2. **Send first message** to WhatsApp chatbot:
   ```
   Hai
   ```

3. **Check Deno logs** for:
   ```
   📊 Current Stage: null
   🚨 THIS IS THE FIRST MESSAGE FROM CUSTOMER 🚨
   ✅ AI Response Parsed (JSON): {
     "Stage": "Welcome Message",
     ...
   }
   ```

4. **Verify customer receives** welcome message (not promo message)

5. **Check database**:
   ```sql
   SELECT stage FROM ai_whatsapp WHERE prospect_num = '+60123456789';
   -- Should show: "Welcome Message"
   ```

6. **Send follow-up message**:
   ```
   Ok berapa harga?
   ```

7. **Check Deno logs** for:
   ```
   📊 Current Stage: Welcome Message
   📍 Continue from stage: "Welcome Message"
   ✅ AI Response Parsed (JSON): {
     "Stage": "Introduction",  // or next appropriate stage
     ...
   }
   ```

---

## 🔧 Files Changed

### `deno-backend/complete-webhook-single-file.ts`

**Lines 565-581**: Updated CURRENT CONTEXT section in `buildDynamicSystemPrompt()`

**Before**:
```typescript
### CURRENT CONTEXT:
- Current Stage: ${currentStage || stages[0] || 'First Stage'}
- Available Stages: ${stages.join(', ')}
- Previous Conversation:
${conversationHistory}
```

**After**:
```typescript
### CURRENT CONTEXT:
- Current Stage: ${currentStage || stages[0] || 'First Stage'}
- Available Stages: ${stages.map((s, i) => `${i + 1}. ${s}`).join(', ')}
- Previous Conversation:
${conversationHistory || 'No previous conversation - this is the FIRST message'}

${!currentStage ? `
🚨 THIS IS THE FIRST MESSAGE FROM CUSTOMER 🚨
- You MUST use: "Stage": "${stages[0] || 'Welcome Message'}"
- Do NOT skip stages or jump ahead
- Follow the exact script for the first stage
- Do NOT use "Create Urgency" or any other stage
` : `
📍 Continue from stage: "${currentStage}"
- Progress to next stage only if customer's response matches the intent
- Follow the stage flow sequentially
`}
```

---

## 📝 Expected Behavior

### Example Correct Flow:

**Message 1** (First contact):
```
Customer: Hai
AI Stage: "Welcome Message"
AI Response: "Hi! Terima kasih kerana menghubungi kami..."
```

**Message 2**:
```
Customer: Nak tanye sikit blh?
AI Stage: "Introduction"
AI Response: "Tentu boleh! Kami ada..."
```

**Message 3** (Customer asks about pricing):
```
Customer: Berapa harga?
AI Stage: "Create Urgency with Promotions"
AI Response: "Hai kak!🔥 PROMO JIMAT BERGANDA..."
```

---

## ⚠️ Important Notes

1. **Exception Case**: The AI should ONLY skip the welcome message if the customer's FIRST message explicitly asks for pricing/packages (e.g., "Berapa harga pakej?"). This is handled by the AI's understanding, not hardcoded logic.

2. **Stage Names Must Match**: The stage name in the AI response MUST match exactly one of the stages extracted from the user's prompt.

3. **Fallback**: If `stages[0]` is undefined, defaults to "First Stage" or "Welcome Message".

4. **No Breaking Changes**: Existing prompts continue to work - this fix only improves first message handling.

---

## 🐞 Troubleshooting

### Problem: AI still skips welcome message

**Check 1**: Is `currentStage` truly null?
```
Look for log: "📊 Current Stage: null"
```

**Check 2**: Did the prompt extract stages correctly?
```
Look for log: "Available Stages: 1. Welcome Message, 2. Introduction, ..."
```

**Check 3**: Is the AI model ignoring instructions?
- Try using a different model (e.g., GPT-4 instead of GPT-3.5)
- Check `device_setting.api_key_option`

### Problem: AI stuck on first stage

**Check**: Is the stage progression logic too strict?
- The AI should move to next stage when customer's response indicates readiness
- May need to adjust user's prompt to be clearer about when to progress

---

## 📚 Related Documentation

- [UNIFIED_PROMPT_SYSTEM_FIX.md](./UNIFIED_PROMPT_SYSTEM_FIX.md) - Media support fix
- [BEFORE_AFTER_COMPARISON.md](./BEFORE_AFTER_COMPARISON.md) - System evolution
- [MEDIA_SUPPORT_COMPLETE.md](./MEDIA_SUPPORT_COMPLETE.md) - Media handling guide

---

**Status**: ✅ Fixed and Ready for Testing
**Date**: 2025-01-17
**Breaking Changes**: None
**Deployment**: Ready for Deno Deploy
