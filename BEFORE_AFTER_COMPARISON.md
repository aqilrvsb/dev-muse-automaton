# Before vs After: Dynamic Prompt System Integration

## 📊 What Changed in complete-webhook-single-file.ts

### BEFORE: Static JSON Format Only

#### Old System Prompt (Lines 291-382):
```typescript
const systemContent = (prompt.prompts_data || "You are a helpful assistant.") + `

### Instructions:
1. If the current stage is null or undefined, default to the first stage.
2. Always analyze the user's input to determine the appropriate stage.
3. Follow all rules and steps strictly.

### Response Format:
{
  "Stage": "[Stage]",
  "Response": [
    {"type": "text", "content": "..."}
  ]
}
```

#### Old AI Response Processing (Lines 362-377):
```typescript
const aiResponseRaw = await generateAIResponse(
  systemContent,
  lastText,
  currentText,
  device.api_key,
  device.api_key_option || "openai/gpt-4o-mini"
);

// Parse AI response JSON
let aiResponse;
try {
  aiResponse = JSON.parse(aiResponseRaw);
} catch (error) {
  // Fallback to simple format
  aiResponse = {
    Stage: "Unknown",
    Response: [{ type: "text", content: aiResponseRaw }]
  };
}
```

#### Old Database Update (Lines 432-466):
```typescript
await supabaseAdmin
  .from("ai_whatsapp")
  .update({
    conv_last: convLast,
    stage: aiResponse.Stage || null,
    conv_current: null,
  })
  .eq("id_prospect", conversation.id_prospect);

// NO detail capture
// NO stage marker extraction
// NO dynamic prompt support
```

### AFTER: Dynamic Prompt System + Backward Compatibility

#### New Helper Functions Added (Lines 554-728):
```typescript
// 1. Extract stages from user's prompt
function extractStagesFromPrompt(promptData: string): string[]

// 2. Extract customer details from %% markers
function extractDetailsFromResponse(response: string): string | null

// 3. Extract stage from !!Stage!! marker
function extractStageFromResponse(response: string): string | null

// 4. Build dynamic system prompt with auto-injected rules
function buildDynamicSystemPrompt(
  promptData: string,
  conversationHistory: string,
  currentStage: string | null,
  useOneMessage: boolean = false
): string

// 5. Parse AI response and extract structured data
function parseAIResponse(response: string): ParsedAIResponse
```

#### New Conversation History Building (Lines 287-308):
```typescript
// Build conversation history from ai_whatsapp table
const { data: history } = await supabaseAdmin
  .from("ai_whatsapp")
  .select("prospect_num, conv_last, stage, date_insert")
  .eq("device_id", device.device_id)
  .eq("prospect_num", phone)
  .order("date_insert", { ascending: false })
  .limit(10);

let conversationHistoryText = "";
let currentStage: string | null = null;

if (history && history.length > 0) {
  currentStage = history[0].stage || null;
  conversationHistoryText = history
    .reverse()
    .map(h => `[${h.date_insert}] Customer: ${h.conv_last}`)
    .join("\n");
}
```

#### New Dynamic System Prompt (Lines 310-322):
```typescript
console.log(`📊 Current Stage: ${currentStage || 'First Stage'}`);

const promptData = prompt.prompts_data || "You are a helpful assistant.";

const systemContent = buildDynamicSystemPrompt(
  promptData,
  conversationHistoryText,
  currentStage,
  false
);

// Old system content kept for backward compatibility
```

#### New AI Response Parsing (Lines 398-429):
```typescript
// Try JSON format first (backward compatibility)
let aiResponse;
let parsedResponse: ParsedAIResponse | null = null;
let isDynamicPromptFormat = false;

try {
  aiResponse = JSON.parse(aiResponseRaw);
  console.log(`✅ AI Response Parsed (JSON format)`);
} catch (error) {
  // Use dynamic prompt system parser
  console.log(`📋 Using dynamic prompt system parser...`);
  parsedResponse = parseAIResponse(aiResponseRaw);
  isDynamicPromptFormat = true;

  console.log(`✅ AI Response Parsed (Dynamic format):`);
  console.log(`   Stage: ${parsedResponse.stage || 'None'}`);
  console.log(`   Has Details: ${parsedResponse.hasDetails ? 'Yes' : 'No'}`);

  if (!parsedResponse.hasStageMarker) {
    console.warn(`⚠️ Warning: AI response missing !!Stage!! marker.`);
  }

  // Convert to legacy format for processing
  aiResponse = {
    Stage: parsedResponse.stage || "Unknown",
    Response: [{ type: "text", content: parsedResponse.cleanContent }]
  };
}
```

#### New Database Update with Detail Capture (Lines 509-533):
```typescript
const updateData: any = {
  conv_last: convLast,
  stage: aiResponse.Stage || null,
  conv_current: null,
};

// Save extracted details from dynamic prompt format
if (isDynamicPromptFormat && parsedResponse) {
  if (parsedResponse.details) {
    updateData.detail = parsedResponse.details;
    console.log(`📝 Saving customer details: ${parsedResponse.details.substring(0, 100)}...`);
  }
}

await supabaseAdmin
  .from("ai_whatsapp")
  .update(updateData)
  .eq("id_prospect", conversation.id_prospect);

console.log(`✅ Updated conversation:`);
console.log(`   - Stage: ${aiResponse.Stage}`);
console.log(`   - Has Details: ${isDynamicPromptFormat && parsedResponse?.hasDetails ? 'Yes' : 'No'}`);
```

## 🎯 Key Improvements

### 1. **Dynamic Stage Detection**
- **Before**: Hardcoded stages in prompt format
- **After**: Auto-extracts ANY stage names from user's prompt using regex

### 2. **Detail Capture**
- **Before**: No detail capture mechanism
- **After**: Automatically captures ANY data between `%%` markers and saves to database

### 3. **Conversation History**
- **Before**: Only used `conv_last` field
- **After**: Builds full conversation history from last 10 messages

### 4. **Stage Tracking**
- **Before**: Stage saved but not actively tracked
- **After**: Current stage detected from history and used in prompt

### 5. **System Prompt**
- **Before**: Static template appended to user's prompt
- **After**: Dynamic template with auto-injected available stages and critical instructions

### 6. **Response Parsing**
- **Before**: JSON-only parsing
- **After**: Dual-mode parser (JSON + Dynamic format with markers)

### 7. **Backward Compatibility**
- **Before**: N/A
- **After**: Old JSON format still works - no breaking changes!

## 📈 Feature Comparison Table

| Feature | Before | After |
|---------|--------|-------|
| Stage Detection | ❌ Static | ✅ Dynamic (Auto-extract) |
| Detail Capture | ❌ None | ✅ Any fields with %% |
| Conversation History | ❌ Single message | ✅ Last 10 messages |
| Current Stage Tracking | ❌ Not used | ✅ Actively tracked |
| Variable Replacement | ❌ Not supported | ✅ {{name}}, {{phone}}, etc. |
| Response Format | JSON only | JSON + Dynamic markers |
| Database Fields Used | stage, conv_last | stage, detail, conv_last |
| Custom Stage Names | ❌ Limited | ✅ Unlimited |
| Backward Compatible | N/A | ✅ Yes |

## 🔄 Migration Path

### No Migration Needed!

The system automatically detects the format:
1. If AI returns JSON → Uses old parser
2. If AI returns text with markers → Uses new parser
3. Both save to database correctly

### To Use New Features:

Just update your prompt to include:
```
!!Stage Welcome!!
Your content here...

!!Stage Details!!
When collecting info:
%%FIELD1: value
FIELD2: value%%
```

That's it! The system handles the rest automatically.

---

**Status**: ✅ Complete - Fully Backward Compatible
**Testing**: Ready for production deployment
**Breaking Changes**: None
