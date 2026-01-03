# Deployment Checklist - WhatsApp AI Chatbot Fixes

## ✅ Pre-Deployment Verification

### Files Ready for Deployment:
- [x] `deno-backend/complete-webhook-single-file.ts` - Updated with all fixes
- [x] `deno-backend/services/ai.ts` - Updated for consistency (dev only)

### Changes Applied:
- [x] Fix #1: Media support (images, videos, audio)
- [x] Fix #2: Unified prompt system (removed duplicate prompts)
- [x] Fix #3: Stage flow logic (first message handling)

### Documentation Created:
- [x] `UNIFIED_PROMPT_SYSTEM_FIX.md`
- [x] `STAGE_FLOW_FIX.md`
- [x] `ALL_FIXES_SUMMARY.md`
- [x] `DEPLOYMENT_CHECKLIST.md` (this file)

---

## 🚀 Deployment Steps

### Step 1: Deploy to Deno Deploy
```bash
# Only this file needs to be deployed:
deno-backend/complete-webhook-single-file.ts
```

**Note**: The modular files (`services/ai.ts`, `handlers/ai.ts`, etc.) are for local development only and do NOT need to be deployed.

### Step 2: Verify Environment Variables
Ensure these are set in Deno Deploy:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- Any other required environment variables

### Step 3: Test Webhook Endpoint
```bash
# Test the webhook is responding
curl -X POST https://your-deno-app.deno.dev/webhook \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## 🧪 Post-Deployment Testing

### Test 1: First Message - Welcome Stage ✅
**Goal**: Verify AI starts with first stage (Welcome Message)

**Steps**:
1. Clear test conversation:
   ```sql
   DELETE FROM ai_whatsapp WHERE prospect_num = '+60XXXXXXXXX';
   ```

2. Send first WhatsApp message:
   ```
   Hai
   ```

3. **Expected Deno Logs**:
   ```
   📊 Current Stage: null
   🚨 THIS IS THE FIRST MESSAGE FROM CUSTOMER 🚨
   ✅ AI Response Parsed (JSON): {
     "Stage": "Welcome Message",
     ...
   }
   ```

4. **Expected WhatsApp Response**:
   - Customer receives welcome message (not promo)

5. **Expected Database**:
   ```sql
   SELECT stage FROM ai_whatsapp WHERE prospect_num = '+60XXXXXXXXX';
   -- Result: "Welcome Message"
   ```

**Result**: [ ] Pass / [ ] Fail

---

### Test 2: Image Media Support ✅
**Goal**: Verify images sent as actual media (not text URLs)

**Steps**:
1. Continue conversation to a stage with images (e.g., "Create Urgency with Promotions")

2. **Expected Deno Logs**:
   ```
   ✅ AI Response Parsed (JSON): {
     "Stage": "Create Urgency with Promotions",
     "Response": [
       {"type": "text", "content": "..."},
       {"type": "image", "content": "https://automation.../image1.jpg"},
       {"type": "image", "content": "https://automation.../image2.jpg"}
     ]
   }
   📤 Sending message 1/3 (text)
   📤 Sending message 2/3 (image)
   📤 Sending message 3/3 (image)
   ```

3. **Expected WhatsApp Response**:
   - Text message
   - Image 1 (displayed inline, not as URL text)
   - Image 2 (displayed inline, not as URL text)

**Result**: [ ] Pass / [ ] Fail

---

### Test 3: Video Media Support ✅
**Goal**: Verify videos sent as actual media

**Steps**:
1. If your prompt includes video stages, progress to that stage

2. **Expected Deno Logs**:
   ```
   📤 Sending message X/Y (video)
   ```

3. **Expected WhatsApp Response**:
   - Video sent as playable media (not URL text)

**Result**: [ ] Pass / [ ] Fail / [ ] N/A (no videos in prompt)

---

### Test 4: Detail Capture ✅
**Goal**: Verify customer details extracted and saved

**Steps**:
1. Progress to detail collection stage

2. Send customer details:
   ```
   Nama saya Ali, alamat 123 Jalan Sultan, no fone 0123456789
   ```

3. **Expected Deno Logs**:
   ```
   📝 Extracted Details: NAMA: Ali
   ALAMAT: 123 Jalan Sultan
   NO FONE: 0123456789...
   📝 Saving customer details: NAMA: Ali...
   ✅ Updated conversation:
      - Stage: Collect Details
      - Has Details: Yes
   ```

4. **Expected Database**:
   ```sql
   SELECT detail FROM ai_whatsapp WHERE prospect_num = '+60XXXXXXXXX';
   -- Result: "NAMA: Ali\nALAMAT: 123 Jalan Sultan\nNO FONE: 0123456789"
   ```

**Result**: [ ] Pass / [ ] Fail

---

### Test 5: Stage Progression ✅
**Goal**: Verify stages progress sequentially

**Steps**:
1. Have a multi-turn conversation
2. Check database after each message:
   ```sql
   SELECT stage, conv_last FROM ai_whatsapp
   WHERE prospect_num = '+60XXXXXXXXX'
   ORDER BY date_insert DESC LIMIT 5;
   ```

3. **Expected Result**:
   - Stages progress in order (e.g., Welcome Message → Introduction → TARGET CLARIFICATION)
   - Each message updates the stage appropriately

**Result**: [ ] Pass / [ ] Fail

---

### Test 6: Detail Confirmation Display ✅
**Goal**: Verify captured details are displayed to customer when confirming

**Steps**:
1. Progress to detail collection stage

2. Provide customer details:
   ```
   Nama saya Aiman, alamat Lot68262672 ndjdis, no fone 60179645043, saya nak 1 Botol Vitac, COD
   ```

3. **Expected Deno Logs**:
   ```
   ✅ AI Response Parsed (JSON): {
     "Stage": "Confirm Details",
     "Detail": "%%NAMA: Aiman\nALAMAT: Lot68262672 ndjdis\nNO FONE: 60179645043\nPAKEJ: 1 Botol Vitac\nCARA BAYARAN: COD%%",
     "Response": [
       {"type": "text", "content": "Sila semak detail tempahan:"},
       {"type": "text", "content": "NAMA: Aiman\nALAMAT: Lot68262672 ndjdis\nNO FONE: 60179645043\nPAKEJ: 1 Botol Vitac\nCARA BAYARAN: COD"},
       {"type": "text", "content": "Semua detail dah betul kan?"}
     ]
   }
   ```

4. **Expected WhatsApp Response**:
   - Customer sees: "Sila semak detail tempahan:"
   - Customer sees all details formatted:
     ```
     NAMA: Aiman
     ALAMAT: Lot68262672 ndjdis
     NO FONE: 60179645043
     PAKEJ: 1 Botol Vitac
     CARA BAYARAN: COD
     ```
   - Customer sees: "Semua detail dah betul kan?"

5. **Expected Database**:
   ```sql
   SELECT detail FROM ai_whatsapp WHERE prospect_num = '+60XXXXXXXXX';
   -- Result should contain: "NAMA: Aiman\nALAMAT: Lot68262672..."
   ```

**Result**: [ ] Pass / [ ] Fail

---

### Test 7: Exception Case - Skip to Relevant Stage ✅
**Goal**: Verify AI can skip to relevant stage if customer explicitly asks

**Steps**:
1. Clear test conversation
2. Send first message directly asking about pricing:
   ```
   Berapa harga pakej?
   ```

3. **Expected Behavior**:
   - AI may skip Welcome Message and go to pricing/promo stage
   - This is CORRECT behavior based on customer intent

**Result**: [ ] Pass / [ ] Fail

---

## 🐞 Troubleshooting Guide

### Issue: Images still sent as text URLs

**Symptoms**:
```
Gambar: [https://automation.../image.jpg]
```

**Diagnosis**:
1. Check Deno logs - is AI returning JSON?
   ```
   Look for: "✅ AI Response Parsed (JSON)"
   ```

2. If not JSON, check AI model:
   ```sql
   SELECT api_key_option FROM device_setting WHERE device_id = 'XXX';
   ```

**Solutions**:
- AI model may be ignoring JSON instructions → Try GPT-4 instead of GPT-3.5
- Check OpenRouter API key is valid
- Verify prompt includes proper JSON examples

---

### Issue: AI skips Welcome Message on first contact

**Symptoms**:
```
Customer: Hai
AI Stage: "Create Urgency with Promotions"  ❌
```

**Diagnosis**:
1. Check Deno logs - is `currentStage` null?
   ```
   Look for: "📊 Current Stage: null"
   ```

2. Check if warning appears:
   ```
   Look for: "🚨 THIS IS THE FIRST MESSAGE FROM CUSTOMER 🚨"
   ```

**Solutions**:
- If warning doesn't appear → System prompt not building correctly
- If warning appears but AI ignores → Try different AI model
- Check stages extracted correctly from prompt

---

### Issue: Details not saved to database

**Symptoms**:
- `ai_whatsapp.detail` remains null after providing info

**Diagnosis**:
1. Check Deno logs:
   ```
   Look for: "📝 Extracted Details: ..."
   ```

2. Check AI response format:
   ```
   "Detail": "%%NAMA: Ali\nALAMAT: ...%%"
   ```

**Solutions**:
- Verify Detail field uses `%%` markers
- Check database column exists: `ai_whatsapp.detail`
- Verify Supabase permissions allow updates

---

### Issue: Details not displayed when confirming

**Symptoms**:
```
AI asks: "Semua detail dah betul kan?"
But customer doesn't see the actual details
```

**Diagnosis**:
1. Check Deno logs - does Response array contain details?
   ```
   Look for: "Response": [
     {"type": "text", "content": "NAMA: ...\nALAMAT: ..."}
   ]
   ```

2. If Response only has confirmation text, AI is ignoring instruction

**Solutions**:
- Ensure prompt has a "Confirm Details" stage that explicitly mentions showing details
- Try GPT-4 for better instruction following
- Add explicit example in your prompt showing detail display format

---

### Issue: Stages not progressing

**Symptoms**:
- AI stuck on same stage despite conversation progress

**Diagnosis**:
1. Check prompt - are stages clearly defined?
2. Check AI is reading conversation history
3. Check currentStage being passed correctly

**Solutions**:
- Make stage progression criteria clearer in prompt
- Verify conversation history is being built correctly
- Check database updates are working

---

## 📊 Success Criteria

All tests must pass:
- [ ] Test 1: First Message - Welcome Stage
- [ ] Test 2: Image Media Support
- [ ] Test 3: Video Media Support (if applicable)
- [ ] Test 4: Detail Capture
- [ ] Test 5: Stage Progression
- [ ] Test 6: Detail Confirmation Display
- [ ] Test 7: Exception Case

**Deployment Status**: [ ] Success / [ ] Needs Fixes

---

## 🔄 Rollback Plan (If Needed)

If deployment fails and you need to rollback:

1. **Revert to previous version** of `complete-webhook-single-file.ts`
2. **Symptoms requiring rollback**:
   - Webhook returns errors
   - No messages sent to customers
   - Database updates failing
   - Critical functionality broken

3. **Files to revert**:
   - `deno-backend/complete-webhook-single-file.ts`

4. **Safe to keep** (documentation only):
   - All `.md` documentation files

---

## 📝 Post-Deployment Notes

### After Testing:
- [ ] Document any issues found
- [ ] Update user's prompt if needed
- [ ] Monitor Deno logs for errors
- [ ] Check database for proper updates

### Performance Monitoring:
- [ ] Response times acceptable (<10s typical)
- [ ] No API rate limit errors
- [ ] OpenRouter API costs within budget
- [ ] Database queries efficient

### User Feedback:
- [ ] Customers receiving correct welcome message
- [ ] Images displaying properly
- [ ] Conversation flow natural
- [ ] Details being captured correctly

---

## ✅ Deployment Sign-Off

**Deployed By**: _______________
**Deployment Date**: _______________
**Deployment Time**: _______________
**All Tests Passed**: [ ] Yes / [ ] No
**Issues Found**: _______________
**Status**: [ ] Production Ready / [ ] Needs Fixes

---

## 📚 Additional Resources

- [ALL_FIXES_SUMMARY.md](./ALL_FIXES_SUMMARY.md) - Complete overview of all fixes
- [UNIFIED_PROMPT_SYSTEM_FIX.md](./UNIFIED_PROMPT_SYSTEM_FIX.md) - Media support details
- [STAGE_FLOW_FIX.md](./STAGE_FLOW_FIX.md) - Stage flow logic details
- [BEFORE_AFTER_COMPARISON.md](./BEFORE_AFTER_COMPARISON.md) - System comparison

**Support**: Check Deno Deploy logs for detailed error messages
**Database**: Check Supabase logs for query issues
**API**: Check OpenRouter dashboard for API usage and errors
