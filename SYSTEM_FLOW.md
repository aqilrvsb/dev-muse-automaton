# System Flow - Incoming Message Processing

## Overview
This document explains how the system processes incoming WhatsApp messages from users.

## Flow Diagram

```
User sends WhatsApp message
         ↓
[1] WhatsApp Provider (WAHA)
         ↓
[2] Webhook Handler (deno-backend/handlers/webhook.ts)
         ↓
[3] Message Debouncer (deno-backend/services/debounce.ts)
         ↓ (4 second delay)
[4] Flow Execution Engine (deno-backend/services/flow-execution.ts)
         ↓
[5] AI Response Generator (deno-backend/services/ai.ts)
         ↓
[6] WhatsApp Provider sends reply
         ↓
User receives response
```

## Detailed Steps

### 1. User Sends Message
- User sends a WhatsApp message to a connected device
- The message goes through WhatsApp's infrastructure

### 2. Webhook Handler Receives Message
**File:** `deno-backend/handlers/webhook.ts`

**Process:**
- WAHA (WhatsApp provider) sends a POST request to: `https://pening-bot.deno.dev/{device_id}/{webhook_id}`
- Handler verifies the device exists in `device_setting` table
- Parses the webhook payload using `webhook-parser.ts`
- Extracts: phone number, message content, name
- Queues message for debouncing

**Key Functions:**
- `handleWebhook()` - Main entry point
- `handleWebhookMessage()` - Processes POST requests
- `parseWebhookPayload()` - Parses provider-specific format

### 3. Message Debouncer
**File:** `deno-backend/services/debounce.ts`

**Purpose:** Prevents duplicate responses when users send multiple messages quickly

**Process:**
- Stores messages in Deno KV database
- Waits 4 seconds before processing
- If new message arrives within 4 seconds, timer resets
- Combines multiple messages into one
- After timer expires, sends to flow execution

**Key Functions:**
- `queueMessageForDebouncing()` - Adds message to queue
- `scheduleProcessing()` - Schedules timer
- `checkAndProcess()` - Checks if timer expired
- `processMessages()` - Combines messages and triggers flow execution

**Data Structure:**
```typescript
{
  deviceId: string
  webhookId: string
  phone: string
  name: string
  provider: string
  messages: [{ message: string, timestamp: number }]
  lastMessageTime: number
  timerScheduled: number
}
```

### 4. Flow Execution Engine
**File:** `deno-backend/services/flow-execution.ts`

**Process:**
1. Gets device configuration from `device_setting`
2. Checks for active conversation in `ai_whatsapp` table
3. If no conversation exists, creates new one
4. If conversation exists, updates it with new message
5. Gets associated flow (if configured)
6. Executes flow node logic OR uses simple AI response
7. Sends response via WhatsApp

**Database Tables Used:**
- `device_setting` - Device configuration
- `ai_whatsapp` - Conversation history and state
- `prompts` (potentially) - Custom prompts per device
- `flows` - Flow definitions (if using flows)

**Key Functions:**
- `processFlowMessage()` - Main processing function
- `getActiveConversation()` - Finds existing conversation
- `createNewConversation()` - Creates new conversation record
- `updateConversation()` - Updates conversation with new message
- `executeFlowNode()` - Executes flow logic
- `handleSimpleAIResponse()` - Handles non-flow AI responses

### 5. AI Response Generation
**File:** `deno-backend/services/ai.ts`

**Process:**
- Takes conversation context
- Uses device's configured AI model (from `device_setting.api_key_option`)
- Uses custom prompts (from `prompts` table if exists)
- Generates response based on:
  - Current conversation state (`ai_whatsapp.stage`)
  - Conversation history (`ai_whatsapp.conv_last`, `ai_whatsapp.conv_current`)
  - User message
  - System prompts
- Returns AI-generated response

**Key Functions:**
- `generateFlowAIResponse()` - Generates AI response
- Uses OpenRouter API for multi-model support

### 6. Send Response
**File:** `deno-backend/services/whatsapp-provider.ts`

**Process:**
- Takes generated response
- Formats for WhatsApp provider (WAHA)
- Sends POST request to WAHA API
- WAHA sends message to user via WhatsApp

**Key Functions:**
- `sendWhatsAppMessage()` - Sends message via provider

## Database Schema (ai_whatsapp)

After migration, the `ai_whatsapp` table contains:

```sql
- id_prospect (serial, PK)
- device_id (varchar 255)
- prospect_name (varchar 225)
- prospect_num (varchar 255, unique)
- niche (varchar 255)
- intro (varchar 255)
- stage (varchar 255)
- conv_last (text)
- conv_current (text)
- human (integer, default 0)  -- 0 = AI, 1 = Human
- date_insert (date, Y-m-d format)
- user_id (uuid, FK to "user"(id))
- detail (text)
```

## Important Notes

### Session Tables (REMOVED)
The following tables are **NO LONGER USED** and should be removed:
- `ai_whatsapp_session` - Replaced by conversation state in `ai_whatsapp`
- `wasapBot_session` - Legacy table, no longer needed

The system now tracks conversation state directly in the `ai_whatsapp` table using:
- `stage` - Current conversation stage
- `conv_last` - Previous conversation
- `conv_current` - Current conversation
- `human` - Flag to indicate if human takeover

### Key Features

1. **Debouncing (4 seconds)**
   - Prevents duplicate responses
   - Combines rapid-fire messages
   - Improves conversation quality

2. **Multi-Provider Support**
   - Currently supports WAHA
   - Extensible to Wablas, WhatsApp Center

3. **Conversation State Management**
   - Tracks conversation history
   - Maintains conversation stage
   - Supports human takeover

4. **Flexible AI Integration**
   - Supports multiple AI models
   - Custom prompts per device
   - Flow-based or simple AI responses

5. **Row Level Security (RLS)**
   - Users can only see their own conversations
   - Enforced at database level

## Configuration

### Webhook URL Format
```
https://pening-bot.deno.dev/{device_id}/{webhook_id}
```

### Device Settings
Stored in `device_setting` table:
- `device_id` - Unique device identifier
- `webhook_id` - Webhook URL endpoint
- `instance` - WAHA session name
- `provider` - WhatsApp provider type
- `api_key_option` - AI model to use
- `api_key` - OpenRouter API key
- `phone_number` - Connected phone number

### AI Models Supported
- GPT-5 Chat
- GPT-5 Mini
- GPT-4o Latest
- GPT-4.1
- Gemini 2.5 Pro
- Gemini Pro 1.5

## Error Handling

1. **Webhook Errors**
   - Device not found → 404
   - Invalid payload → 400
   - Processing error → 500

2. **Debounce Errors**
   - Queue cleared automatically after error
   - Old queues (>10min) cleaned up automatically

3. **Flow Execution Errors**
   - Falls back to simple AI response
   - Logs error details
   - Continues operation

## Performance

- **Debounce Delay:** 4 seconds
- **Queue Cleanup:** Every 10 minutes
- **Old Queue Threshold:** 10 minutes
- **Message Limit:** 100 conversations loaded in UI

## Future Enhancements

1. ✅ Remove `ai_whatsapp_session` table
2. ✅ Remove `wasapBot_session` table
3. Add conversation search/filter
4. Add message history viewer
5. Add bulk operations
6. Add conversation analytics
7. Add conversation export
