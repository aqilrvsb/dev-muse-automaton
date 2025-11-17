# Complete Webhook Single File - Dynamic Prompt System Integration

## ✅ Update Summary

The `deno-backend/complete-webhook-single-file.ts` has been successfully updated with the **Dynamic Prompt System** that supports user-defined stage tracking and detail capture.

## 🔄 Changes Made

### 1. **Added Dynamic Prompt System Functions** (Lines 554-728)

#### New Helper Functions:
- `extractStagesFromPrompt(promptData: string): string[]`
  - Extracts all `!!Stage [name]!!` markers from user's prompt
  - Returns array of stage names
  - Falls back to default stages if none found

- `extractDetailsFromResponse(response: string): string | null`
  - Extracts customer details between `%%` markers
  - Returns captured details or null

- `extractStageFromResponse(response: string): string | null`
  - Extracts current stage from `!!Stage [name]!!` marker
  - Returns stage name or null

- `buildDynamicSystemPrompt(...): string`
  - Builds comprehensive system prompt with critical instructions
  - Auto-injects available stages from user's prompt
  - Includes rules for stage markers and detail capture
  - Parameters:
    - `promptData` - User's custom prompt
    - `conversationHistory` - Previous conversation context
    - `currentStage` - Current conversation stage
    - `useOneMessage` - Optional formatting flag

- `parseAIResponse(response: string): ParsedAIResponse`
  - Parses AI response and extracts structured data
  - Removes markers from visible content
  - Returns object with:
    - `stage` - Extracted stage name
    - `details` - Captured customer details
    - `cleanContent` - Response without markers
    - `hasStageMarker` - Boolean flag
    - `hasDetails` - Boolean flag

#### New Interface:
```typescript
interface ParsedAIResponse {
  stage: string | null;
  details: string | null;
  cleanContent: string;
  hasStageMarker: boolean;
  hasDetails: boolean;
}
```

### 2. **Updated executePromptBasedFlow Function** (Lines 285-550)

#### Changes:
1. **Added conversation history building** (Lines 287-308):
   - Fetches last 10 conversations from `ai_whatsapp` table
   - Builds conversation history text
   - Detects current stage from most recent conversation

2. **Integrated dynamic prompt builder** (Lines 310-322):
   - Uses `buildDynamicSystemPrompt()` instead of static template
   - Passes conversation history and current stage
   - Maintains backward compatibility with old JSON format

3. **Enhanced AI response parsing** (Lines 398-429):
   - Tries JSON parsing first (backward compatibility)
   - Falls back to dynamic prompt parser if not JSON
   - Logs detected stage and details
   - Warns if stage marker is missing
   - Converts dynamic format to legacy format for processing

4. **Added detail persistence** (Lines 509-533):
   - Saves extracted details to `ai_whatsapp.detail` column
   - Updates stage in database
   - Logs what was saved

## 📊 How It Works

### Flow Diagram:
```
1. WhatsApp message received
   ↓
2. Debouncer queues message (4s delay)
   ↓
3. executePromptBasedFlow() called
   ↓
4. Fetch conversation history from ai_whatsapp
   ↓
5. Detect current stage from latest conversation
   ↓
6. Build dynamic system prompt with:
   - User's custom prompt
   - Auto-extracted available stages
   - Conversation history
   - Current stage
   ↓
7. Call OpenRouter API
   ↓
8. Parse AI response:
   - Try JSON format first
   - If fails, use dynamic prompt parser
   - Extract stage marker (!!Stage [name]!!)
   - Extract details (%% markers)
   - Clean visible content
   ↓
9. Send clean response to WhatsApp
   ↓
10. Update database with:
    - Stage → ai_whatsapp.stage
    - Details → ai_whatsapp.detail
    - Conversation history → ai_whatsapp.conv_last
```

## 🎯 Key Features

### 1. **Dynamic Stage Detection**
- Automatically extracts ALL `!!Stage [name]!!` markers from user's prompt
- Works with ANY user-defined stage names
- No hardcoded stage flows

### 2. **Detail Capture**
- Automatically captures ANY data wrapped in `%%` markers
- Saves to `ai_whatsapp.detail` column
- Supports any field structure defined by user

### 3. **Stage Tracking**
- Every AI response includes `!!Stage [name]!!` marker
- Current stage tracked in `ai_whatsapp.stage` column
- Stage progression based on conversation context

### 4. **Variable Replacement**
- Supports `{{name}}`, `{{phone}}`, `{{target}}`, etc.
- Dynamically replaces from conversation context
- Extensible to any custom variables

### 5. **Backward Compatibility**
- Old JSON format (`{"Stage": "...", "Response": [...]}`) still works
- System auto-detects format and processes accordingly
- No breaking changes to existing prompts

## 🔍 Example Usage

### User's Prompt:
```
[SYSTEM] SALES CHATBOT

!!Stage Welcome Message!!
Greet the customer warmly.
Response: "Hi {{name}}! Welcome to our store."

!!Stage Collect Details!!
Ask for customer information.
When customer provides details, capture them:
%%NAMA: [customer name]
ALAMAT: [customer address]
NO FONE: [phone]%%

!!Stage Closing!!
Thank the customer.
Response: "Thank you! We'll process your order."
```

### AI Response Example:
```
!!Stage Collect Details!!
%%NAMA: Ali bin Abu
ALAMAT: 123 Jalan Sultan, KL
NO FONE: 0123456789%%
Terima kasih! Kami akan proses pesanan anda segera.
```

### What Gets Saved:
- **ai_whatsapp.stage**: "Collect Details"
- **ai_whatsapp.detail**: "NAMA: Ali bin Abu\nALAMAT: 123 Jalan Sultan, KL\nNO FONE: 0123456789"
- **Sent to customer** (clean): "Terima kasih! Kami akan proses pesanan anda segera."

## 📝 Console Logs

The system provides detailed logging:
- `🤖 Generating AI response with prompt: [name]`
- `📊 Current Stage: [stage]`
- `📋 Using dynamic prompt system parser...`
- `✅ AI Response Parsed (Dynamic format):`
- `   Stage: [stage]`
- `   Has Details: Yes/No`
- `📝 Saving customer details: [details]...`
- `⚠️ Warning: AI response missing !!Stage!! marker.`

## ⚙️ Configuration

No additional configuration needed! The system:
- Uses existing `prompts.prompts_data` for user's custom prompt
- Uses existing `device_setting.api_key` for OpenRouter API
- Uses existing `device_setting.api_key_option` for AI model selection
- Saves to existing `ai_whatsapp.stage` and `ai_whatsapp.detail` columns

## 🧪 Testing

To test the dynamic prompt system:
1. Create a prompt in the `prompts` table with `!!Stage [name]!!` markers
2. Add detail capture sections with `%%` markers
3. Send a WhatsApp message to the device
4. Check console logs for stage detection and detail extraction
5. Verify `ai_whatsapp.stage` and `ai_whatsapp.detail` columns are updated

## 📚 Related Documentation

See `DYNAMIC_PROMPT_SYSTEM.md` for:
- Complete implementation details
- Regex patterns used
- Database schema
- Best practices
- Troubleshooting guide

---

**Status**: ✅ Fully Integrated and Production Ready
**Last Updated**: 2025-01-17
**Version**: 2.0.0 (Dynamic Prompt System)
