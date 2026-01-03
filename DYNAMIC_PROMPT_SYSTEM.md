# Dynamic Prompt System - Implementation Guide

## 🎯 Overview

The Dynamic Prompt System allows users to define custom chatbot behaviors with automatic stage tracking, detail capture, and variable replacement. The system automatically extracts stage flow from user-defined prompts and manages conversations intelligently.

## 📋 Key Features

### 1. **Dynamic Stage Detection**
- Automatically extracts all `!!Stage [name]!!` markers from prompts
- Supports ANY user-defined stage names
- No hardcoded stage flows

### 2. **Detail Capture with %% Markers**
- Automatically captures customer information wrapped in `%%` markers
- Saves to `ai_whatsapp.detail` column
- Supports any field structure defined by user

### 3. **Stage Tracking**
- Every AI response must include `!!Stage [name]!!` marker
- Current stage tracked in `ai_whatsapp.stage` column
- Stage progression based on conversation context

### 4. **Variable Replacement**
- Supports `{{name}}`, `{{phone}}`, `{{target}}`, etc.
- Dynamically replaces from conversation context
- Extensible to any custom variables

## 🔧 Implementation Details

### Files Updated:

#### 1. **deno-backend/services/ai.ts**
**New Functions:**
- `extractStagesFromPrompt(promptData)` - Extracts all stages from prompt using regex
- `extractDetailsFromResponse(response)` - Extracts data between %% markers
- `extractStageFromResponse(response)` - Extracts current stage from !!Stage!! marker
- `buildDynamicSystemPrompt(...)` - Builds comprehensive system prompt with rules
- `parseAIResponse(response)` - Parses AI response and extracts structured data

**Updated Functions:**
- `generateFlowAIResponse(...)` - Now returns `ParsedAIResponse` with:
  - `stage`: Extracted stage name
  - `details`: Captured customer details
  - `cleanContent`: Response without markers
  - `hasStageMarker`: boolean flag
  - `hasDetails`: boolean flag

#### 2. **deno-backend/handlers/ai.ts**
**Updated:**
- `chat()` function now:
  - Fetches prompt from `prompts` table
  - Retrieves conversation history
  - Detects current stage
  - Saves stage and details to database
  - Returns structured response with metadata

#### 3. **deno-backend/services/flow-execution.ts**
**Updated:**
- `generateAIResponse()` function now:
  - Builds conversation history from `ai_whatsapp` table
  - Detects current stage from latest conversation
  - Uses dynamic prompt system
  - Updates conversation with stage and details
  - Warns if stage marker is missing

## 📐 System Prompt Structure

### Critical Instructions (Auto-injected)

```markdown
⚠️ CRITICAL SYSTEM INSTRUCTIONS ⚠️

1. 🚨 MANDATORY STAGE MARKER
   - EVERY response MUST start with: !!Stage [stage name]!!
   - Available stages: [auto-extracted from user's prompt]

2. 📝 DETAILS CAPTURE
   - Wrap customer info in %% markers
   - Format:
     %%NAMA: John Doe
     ALAMAT: 123 Main St
     NO FONE: 0123456789
     PAKEJ: 3 Bottles
     HARGA: RM130%%

3. 🎯 STAGE PROGRESSION
   - Current stage: [tracked automatically]
   - Follow user's defined flow

4. 📊 VARIABLE REPLACEMENT
   - Replace {{name}}, {{phone}}, etc.
   - Extract from conversation context
```

## 🗄️ Database Schema

### ai_whatsapp Table Columns Used:
- `stage` (varchar) - Current conversation stage
- `detail` (text) - Captured customer details (from %% markers)
- `conv_last` (text) - Last message in conversation
- `prospect_num` (varchar) - Customer phone number
- `device_id` (varchar) - Device identifier

### prompts Table Columns Used:
- `prompts_data` (text) - User-defined prompt with stages and flow
- `device_id` (varchar) - Device identifier
- `niche` (varchar) - Business niche/category

## 🚀 Usage Example

### User's Prompt (in prompts.prompts_data):

```
[SYSTEM] SALES CHATBOT

1. !!Stage Welcome Message!!
Purpose: Greet customer
Response: "Hi {{name}}! Welcome to our store."

2. !!Stage Collect Details!!
Purpose: Gather customer information
Response: "Can I get your name and address?"

When customer provides details:
%%NAMA: [customer name]
ALAMAT: [customer address]%%

3. !!Stage Closing!!
Purpose: Close sale
Response: "Thank you! We'll process your order."
```

### System Behavior:

1. **First Message:**
   - AI Response: `!!Stage Welcome Message!!\nHi Ali! Welcome to our store.`
   - Stored in DB:
     - `stage`: "Welcome Message"
     - `detail`: null

2. **Customer provides info:**
   - User: "My name is Ali, address 123 Jalan Sultan"
   - AI Response: `!!Stage Collect Details!!\n%%NAMA: Ali\nALAMAT: 123 Jalan Sultan%%\nThank you!`
   - Stored in DB:
     - `stage`: "Collect Details"
     - `detail`: "NAMA: Ali\nALAMAT: 123 Jalan Sultan"

3. **Final Stage:**
   - AI Response: `!!Stage Closing!!\nThank you! We'll process your order.`
   - Stored in DB:
     - `stage`: "Closing"

## 🔍 Stage Extraction Logic

### Regex Pattern:
```javascript
/!!Stage\s+([^!]+)!!/g
```

### Examples:
- `!!Stage Welcome Message!!` → Extracts: "Welcome Message"
- `!!Stage Order Booking & Confirmation!!` → Extracts: "Order Booking & Confirmation"
- `!!Stage Dapat Detail!!` → Extracts: "Dapat Detail"

## 📦 Detail Extraction Logic

### Regex Pattern:
```javascript
/%%([\s\S]*?)%%/
```

### Examples:
```
%%NAMA: John Doe
ALAMAT: 123 Main St%%
```
Extracts:
```
NAMA: John Doe
ALAMAT: 123 Main St
```

## 🎬 Complete Flow

```
1. User sends WhatsApp message
   ↓
2. Webhook receives message
   ↓
3. Debouncer queues message (4s delay)
   ↓
4. Flow execution service processes:
   - Fetches prompt from database
   - Retrieves conversation history
   - Detects current stage
   ↓
5. AI service generates response:
   - Builds dynamic system prompt
   - Calls OpenRouter API
   - Parses response for stage and details
   ↓
6. Updates database:
   - Saves stage to ai_whatsapp.stage
   - Saves details to ai_whatsapp.detail
   ↓
7. Sends clean response to WhatsApp
   (without !!Stage!! and %% markers)
```

## ⚙️ Configuration

### Environment Variables:
- `OPENROUTER_API_KEY` - API key for AI completions
- Device-specific settings in `device_setting` table:
  - `api_key` - Device-specific API key
  - `api_key_option` - AI model selection

### Default AI Model:
- `openai/gpt-4-turbo` (configured in ai.ts)

## 🐛 Debugging

### Console Logs:
- `🎯 Current Stage: [stage name]` - Shows detected stage
- `📊 Extracted Stage: [stage]` - Shows stage from AI response
- `📝 Has Details: Yes/No` - Indicates if details were captured
- `⚠️ Warning: Response missing stage marker!` - Alert if !!Stage!! is missing

### Common Issues:

1. **Stage not updating:**
   - Check if AI response contains `!!Stage [name]!!`
   - Verify stage name matches one from extracted list

2. **Details not saving:**
   - Ensure details are wrapped in `%%` markers
   - Check format: `%%FIELD: value%%`

3. **Variables not replacing:**
   - Add variable extraction logic in system prompt
   - Ensure conversation context contains required data

## 📝 Best Practices

1. **Prompt Design:**
   - Use clear stage names
   - Include purpose for each stage
   - Define expected user inputs

2. **Detail Capture:**
   - Use consistent field names
   - Capture all relevant info at once
   - Validate before saving

3. **Stage Flow:**
   - Design logical progression
   - Handle edge cases (objections, questions)
   - Plan fallback responses

## 🔐 Security Notes

- API keys stored securely in database
- User isolation via RLS policies
- No sensitive data in logs (masked)
- Details encrypted at rest (Supabase default)

## 📚 References

- OpenRouter API: https://openrouter.ai/docs
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Deno Deploy: https://deno.com/deploy

---

**Last Updated:** 2025-01-16
**Version:** 1.0.0
**Status:** ✅ Implemented and Ready for Production
