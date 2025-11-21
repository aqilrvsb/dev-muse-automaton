# Detailed System Flow - Steps 5, 6, 7

This document provides an in-depth technical explanation of how AI responses are generated and sent to users.

---

## Step 5: AI Response Generation

**File:** `deno-backend/services/ai.ts`

### Overview
The AI service generates intelligent responses using external AI models via the OpenRouter API. It considers conversation history, flow context, and custom prompts to create contextually relevant responses.

### Detailed Process

#### 5.1 Entry Point
When the flow execution engine needs an AI response, it calls:

```typescript
const aiResponse = await generateFlowAIResponse(
  conversationHistory,    // Previous conversation context
  userMessage,           // User's current message
  flowContext,           // Flow node prompt or context
  device                 // Device configuration
);
```

From [flow-execution.ts:279-284](deno-backend/services/flow-execution.ts#L279-L284)

#### 5.2 AI Model Selection
The system supports multiple AI models through OpenRouter:

**Configured in `device_setting` table:**
- `api_key_option` - Specifies which AI model to use
- `api_key` - OpenRouter API key for authentication

**Supported AI Models:**
- GPT-5 Chat (`openai/gpt-5-chat`)
- GPT-5 Mini (`openai/gpt-5-mini`)
- GPT-4o Latest (`openai/gpt-4o-latest`)
- GPT-4.1 (`openai/gpt-4.1`)
- Gemini 2.5 Pro (`google/gemini-2.5-pro`)
- Gemini Pro 1.5 (`google/gemini-pro-1.5`)

#### 5.3 Prompt Construction

The AI service builds a comprehensive system prompt:

```typescript
const systemPrompt = `You are a helpful AI assistant in a WhatsApp conversation.

Flow Context: ${flowContext}
Previous Conversation: ${conversationHistory}

Instructions:
- Respond naturally and conversationally
- Consider the conversation history
- Follow the flow context guidance
- Keep responses concise for WhatsApp
- Use appropriate language based on user input`;
```

**Components:**
1. **Flow Context** - Comes from the flow node's prompt field
   - Example: "You are a customer service agent helping with product inquiries"
   - Guides the AI's role and behavior

2. **Conversation History** - Built from `ai_whatsapp` table:
   - `conv_last` - Previous user message
   - `conv_current` - Current user message
   - Format: `"Previous: [last message]\nCurrent: [current message]"`

3. **Custom Prompts** - Optional prompts from `prompts` table:
   - Loaded by device_id
   - Adds niche-specific instructions
   - Example: "You are helping a real estate agent with lead qualification"

#### 5.4 API Request to OpenRouter

**Request Structure:**
```typescript
const payload = {
  model: device.api_key_option || "openai/gpt-4.1",
  messages: [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: userMessage
    }
  ],
  temperature: 0.7,    // Balanced creativity vs consistency
  max_tokens: 500,     // Limit response length for WhatsApp
  top_p: 1.0,
  frequency_penalty: 0.0,
  presence_penalty: 0.0
};

const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${device.api_key}`,
    "HTTP-Referer": "https://pening-bot.deno.dev",
    "X-Title": "Muse Automaton"
  },
  body: JSON.stringify(payload)
});
```

**Key Parameters:**
- `temperature: 0.7` - Balanced between creative and consistent responses
- `max_tokens: 500` - Keeps responses concise for WhatsApp (approximately 250-300 words)
- `top_p: 1.0` - Uses full probability distribution for word selection

#### 5.5 Response Processing

**OpenRouter Response Format:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "openai/gpt-4.1",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 50,
    "total_tokens": 200
  }
}
```

**Extraction:**
```typescript
const result = await response.json();
const aiContent = result.choices[0].message.content;
return aiContent;
```

#### 5.6 Fallback Mechanism

If AI generation fails:
```typescript
try {
  return await generateFlowAIResponse(...);
} catch (error) {
  console.error("AI generation error:", error);
  // Fallback to default message
  return "Maaf, saya mengalami kendala teknis. Silakan coba lagi nanti.";
}
```

From [flow-execution.ts:388-390](deno-backend/services/flow-execution.ts#L388-L390)

### Flow Node Types

The AI service is called differently based on flow node type:

#### Message Node
- Sends predefined text
- No AI generation needed
- Moves to next node automatically

#### AI Node
- Triggers AI generation
- Uses node's prompt as flow context
- Example node data:
```json
{
  "type": "ai",
  "data": {
    "prompt": "Help the user with their product inquiry",
    "temperature": 0.7
  }
}
```

#### Conditional Node
- Evaluates user input
- Routes to different AI nodes based on conditions
- Can trigger different AI contexts

---

## Step 6: Send Response via WhatsApp Provider

**File:** `deno-backend/services/whatsapp-provider.ts`

### Overview
After the AI generates a response, the system sends it to the user via a WhatsApp provider API. The system supports multiple providers with automatic provider detection.

### Detailed Process

#### 6.1 Provider Selection

The system routes to the correct provider based on `device_setting.provider`:

```typescript
export async function sendWhatsAppMessage(
  request: SendMessageRequest,
  device: any
): Promise<SendMessageResponse> {
  const provider = device.provider?.toLowerCase() || "waha";

  switch (provider) {
    case "waha":
      return await sendViaWAHA(request, device);
    case "wablas":
      return await sendViaWablas(request, device);
    case "whacenter":
      return await sendViaWhCenter(request, device);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

From [whatsapp-provider.ts:32-48](deno-backend/services/whatsapp-provider.ts#L32-L48)

#### 6.2 WAHA Provider (Default)

**WAHA (WhatsApp HTTP API)** is the primary provider.

**Configuration:**
- `device.api_key` - WAHA server base URL (e.g., `https://waha.example.com`)
- `device.instance` - Session name (e.g., `"default"`, `"session1"`)

**API Call:**
```typescript
async function sendViaWAHA(request: SendMessageRequest, device: any) {
  const { phone, message } = request;
  const baseUrl = device.api_key;      // WAHA server URL
  const session = device.instance;      // Session name

  // Text message endpoint
  const endpoint = `${baseUrl}/api/sendText`;

  // Request body
  const body = {
    session: session,              // "default"
    chatId: `${phone}@c.us`,      // WhatsApp chat ID format
    text: message                  // AI-generated response
  };

  // Send POST request
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`WAHA error (${response.status})`);
  }

  const result = await response.json();
  console.log(`✅ WAHA message sent to ${phone}`);

  return {
    success: true,
    messageId: result.id || result.messageId
  };
}
```

From [whatsapp-provider.ts:72-134](deno-backend/services/whatsapp-provider.ts#L72-L134)

**Request Example:**
```json
POST https://waha.example.com/api/sendText
Content-Type: application/json

{
  "session": "default",
  "chatId": "6281234567890@c.us",
  "text": "Hello! How can I help you today?"
}
```

**Response Example:**
```json
{
  "id": "true_6281234567890@c.us_3EB0123456ABCDEF",
  "timestamp": 1677652288,
  "status": "sent"
}
```

#### 6.3 WhatsApp Chat ID Format

The system converts phone numbers to WhatsApp's internal format:

```typescript
chatId: `${phone}@c.us`
```

**Examples:**
- Input: `"6281234567890"`
- Output: `"6281234567890@c.us"`

**Format Explanation:**
- `@c.us` - Suffix for regular WhatsApp contacts
- `@g.us` - Suffix for group chats (not currently used)

#### 6.4 Media Support

The provider service also supports sending images and files:

**Image Message:**
```typescript
if (mediaType === "image") {
  endpoint = `${baseUrl}/api/sendImage`;
  body = {
    session: session,
    chatId: `${phone}@c.us`,
    url: mediaUrl,           // Image URL
    caption: message         // AI response as caption
  };
}
```

**File/Document:**
```typescript
if (mediaType === "file") {
  endpoint = `${baseUrl}/api/sendFile`;
  body = {
    session: session,
    chatId: `${phone}@c.us`,
    url: mediaUrl,
    filename: "document.pdf",
    caption: message
  };
}
```

#### 6.5 Alternative Providers

**Wablas Provider:**
```typescript
async function sendViaWablas(request: SendMessageRequest, device: any) {
  const apiKey = device.api_key;
  const baseUrl = device.instance || "https://api.wablas.com";

  const response = await fetch(`${baseUrl}/api/send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": apiKey     // API key in header
    },
    body: JSON.stringify({
      phone: phone,               // Direct phone format
      message: message
    })
  });
}
```

From [whatsapp-provider.ts:167-226](deno-backend/services/whatsapp-provider.ts#L167-L226)

**WhatsApp Center Provider:**
```typescript
async function sendViaWhCenter(request: SendMessageRequest, device: any) {
  const baseUrl = device.api_key;
  const deviceId = device.device_id;

  const response = await fetch(`${baseUrl}/send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      device_id: deviceId,        // Device identifier
      number: phone,
      message: message
    })
  });
}
```

From [whatsapp-provider.ts:258-309](deno-backend/services/whatsapp-provider.ts#L258-L309)

#### 6.6 Error Handling

**Network Errors:**
```typescript
try {
  const response = await fetch(endpoint, {...});
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WAHA error (${response.status}): ${errorText}`);
  }
} catch (error) {
  console.error(`❌ WAHA send error:`, error);
  return {
    success: false,
    error: error.message
  };
}
```

**Common Error Scenarios:**
- **404 Not Found** - Session doesn't exist in WAHA
- **401 Unauthorized** - Invalid API credentials
- **500 Internal Server Error** - WAHA server issue
- **Network timeout** - WAHA server unreachable

#### 6.7 Database Update

After sending the message, the conversation is updated:

```typescript
await supabaseAdmin
  .from("ai_whatsapp")
  .update({
    balas: response,                    // Store bot response
    waiting_for_reply: false,           // Mark as responded
    updated_at: new Date().toISOString()
  })
  .eq("id_prospect", conversation.id_prospect);
```

From [flow-execution.ts:200-212](deno-backend/services/flow-execution.ts#L200-L212)

**Updated Fields:**
- `balas` - Bot's response text
- `waiting_for_reply` - Changes from `true` to `false`
- `updated_at` - Timestamp of response

---

## Step 7: User Receives Response

### Overview
The final step is the message delivery from the WhatsApp provider back to the user's WhatsApp application.

### Detailed Process Flow

#### 7.1 WAHA to WhatsApp Servers

**WAHA Architecture:**
```
[Deno Backend] → [WAHA Server] → [WhatsApp Web API] → [WhatsApp Servers]
```

**WAHA's Role:**
- Maintains an active WhatsApp Web session
- Uses Puppeteer/Playwright to control a browser
- Simulates a real WhatsApp Web client
- Sends messages through WhatsApp's official web interface

**Technical Details:**
1. WAHA receives the API request from our Deno backend
2. WAHA locates the active session (based on `session` parameter)
3. WAHA uses browser automation to:
   - Open the chat with `chatId`
   - Type the message into the chat input
   - Click the send button (or inject the message directly)
4. WhatsApp Web API sends the message to WhatsApp servers
5. WhatsApp servers route the message to the recipient's device

#### 7.2 Message Delivery Status

**WAHA Response Stages:**

**Immediately After Send:**
```json
{
  "id": "true_6281234567890@c.us_3EB0123456ABCDEF",
  "timestamp": 1677652288,
  "status": "pending"
}
```

**Status Updates:**
- `pending` - Message sent to WhatsApp servers
- `sent` - Message delivered to WhatsApp servers (1 checkmark ✓)
- `delivered` - Message delivered to user's device (2 checkmarks ✓✓)
- `read` - Message read by user (2 blue checkmarks ✓✓ blue)

**Webhook Notifications:**

If configured, WAHA can send delivery status updates to a status webhook:

```json
POST https://pening-bot.deno.dev/status-webhook
{
  "event": "message.status",
  "session": "default",
  "payload": {
    "id": "true_6281234567890@c.us_3EB0123456ABCDEF",
    "status": "delivered",
    "timestamp": 1677652290
  }
}
```

**Status Meanings:**
- **sent** - WhatsApp confirmed receipt
- **delivered** - User's device received the message
- **read** - User opened and viewed the message

#### 7.3 User Device Reception

**On User's WhatsApp:**

1. **Notification Received**
   - User's phone receives push notification from WhatsApp servers
   - Notification displays: Sender name, message preview
   - Sound/vibration based on user's notification settings

2. **Message Displayed**
   - User opens WhatsApp
   - Message appears in chat thread
   - Timestamp shown below message
   - Read receipts sent back to sender

3. **Message Storage**
   - Message stored locally on user's device
   - Encrypted with WhatsApp's end-to-end encryption
   - Synchronized to WhatsApp's backup servers (if enabled)

#### 7.4 End-to-End Timing

**Typical Latency Breakdown:**

```
User sends message
↓ [< 100ms]
WAHA webhook received
↓ [0-4000ms]
Debounce delay (4 seconds)
↓ [100-500ms]
Database queries + Flow execution
↓ [1000-3000ms]
AI response generation (OpenRouter API)
↓ [100-500ms]
Send via WAHA
↓ [200-1000ms]
WhatsApp delivery to user
--------------------------------
Total: ~5-9 seconds (typical)
```

**Factors Affecting Speed:**
- **Debounce delay** - Fixed 4 seconds
- **AI model** - GPT-4 slower than GPT-3.5
- **Network latency** - User's internet connection
- **WAHA performance** - Server load and location
- **Message complexity** - Longer prompts take more time

#### 7.5 Message Threading

**Conversation Continuity:**

The system maintains conversation context:

```
User: "Hello"
Bot: "Hi! How can I help you?"

[System stores: conv_current = "Hi! How can I help you?"]

User: "What's your return policy?"
Bot: "Our return policy allows..."

[System stores: conv_last = "Hi! How can I help you?"
                conv_current = "Our return policy allows..."]
```

This enables the AI to reference previous exchanges.

#### 7.6 Real-World Example

**Complete Message Flow:**

```
Time: 14:30:00.000
User types: "I need help with my order"
↓
Time: 14:30:00.100
WhatsApp sends to WAHA server
↓
Time: 14:30:00.200
WAHA posts to webhook: POST /device123/webhook456
↓
Time: 14:30:00.300
Webhook handler validates device, queues for debounce
↓
Time: 14:30:04.300
Debounce timer expires (4 seconds later)
↓
Time: 14:30:04.400
Flow execution: Loads conversation from ai_whatsapp table
- Found existing conversation (id_prospect: 789)
- Stage: "active_support"
- Previous message: "Hello"
↓
Time: 14:30:04.500
AI service called:
- Model: openai/gpt-4.1
- Prompt: "You are a customer support agent"
- Context: "Previous: Hello\nCurrent: I need help with my order"
↓
Time: 14:30:06.800
OpenRouter responds (2.3 seconds)
- Response: "I'd be happy to help with your order! Could you please provide your order number?"
↓
Time: 14:30:06.900
Database updated:
- balas: "I'd be happy to help..."
- waiting_for_reply: false
- updated_at: 2025-11-11 14:30:06
↓
Time: 14:30:07.000
Send via WAHA:
- Session: "default"
- ChatId: "6281234567890@c.us"
- Text: "I'd be happy to help..."
↓
Time: 14:30:07.500
WAHA response: { "status": "sent", "id": "msg_abc123" }
↓
Time: 14:30:07.800
WhatsApp delivers to user's device
↓
Time: 14:30:07.850
User's phone shows notification
- Sender: "Customer Support"
- Preview: "I'd be happy to help with your..."
↓
Time: 14:30:08.000
User opens WhatsApp and sees full message
- Status: ✓✓ Delivered
↓
Time: 14:30:10.000
User reads message
- Status: ✓✓ (Blue) Read
- WAHA receives read receipt via webhook (optional)
```

**Total Time:** ~7.8 seconds from user sending to receiving response

---

## Additional Technical Details

### Security & Privacy

**Message Encryption:**
- WhatsApp uses end-to-end encryption
- Messages encrypted on user's device
- Only decrypted on recipient's device
- WAHA sees unencrypted messages (acts as WhatsApp Web client)

**Data Storage:**
- Conversations stored in `ai_whatsapp` table
- Row Level Security (RLS) enforces user isolation
- Each user only sees their own conversations

### Rate Limiting

**WhatsApp Limits:**
- ~1000 messages per day per number (unofficial limit)
- Messages may be flagged as spam if sent too rapidly
- WAHA enforces reasonable rate limits

**System Limits:**
- Debounce prevents rapid-fire responses
- OpenRouter API rate limits apply (varies by plan)

### Monitoring & Logging

**Console Logs:**
```typescript
console.log(`📥 Webhook: POST /${deviceId}/${webhookId}`);
console.log(`✅ Device found: ${device.id_device}`);
console.log(`📩 Message queued for debouncing`);
console.log(`⏰ Timer EXPIRED! Processing 1 messages...`);
console.log(`🔄 Processing flow message for ${deviceId}/${phone}`);
console.log(`✅ WAHA message sent to ${phone}`);
```

**Database Tracking:**
- Every conversation logged in `ai_whatsapp`
- Timestamps: `date_insert`, `updated_at`
- Status: `human` field (0=AI, 1=Human takeover)

---

## Troubleshooting Common Issues

### Issue 1: Message Not Delivered

**Symptoms:**
- No response from bot
- User waiting indefinitely

**Debugging Steps:**
1. Check debounce queue in Deno KV
2. Verify WAHA session is active
3. Check device configuration in `device_setting`
4. Review console logs for errors

**Common Causes:**
- WAHA session disconnected (QR code expired)
- Invalid API credentials
- Network connectivity issues
- Device not found in database

### Issue 2: Slow AI Responses

**Symptoms:**
- Response takes >10 seconds
- User sends multiple messages before response

**Solutions:**
- Switch to faster AI model (GPT-5 Mini instead of GPT-4.1)
- Reduce `max_tokens` parameter
- Check OpenRouter API status
- Optimize prompt length

### Issue 3: Incorrect AI Context

**Symptoms:**
- AI doesn't remember previous messages
- Responses out of context

**Debugging:**
1. Check `conv_last` and `conv_current` in database
2. Verify conversation updates in [flow-execution.ts](deno-backend/services/flow-execution.ts)
3. Review prompt construction in [ai.ts](deno-backend/services/ai.ts)

---

## Performance Optimization

### Caching Strategies

**Device Settings:**
- Cache device configs in memory
- Refresh every 5 minutes
- Reduces database queries

**Prompts:**
- Load custom prompts once per session
- Store in conversation context

### Parallel Processing

**Independent Operations:**
```typescript
// Run in parallel
await Promise.all([
  supabaseAdmin.from("device_setting").select("*"),
  supabaseAdmin.from("prompts").select("*"),
  kv.get(["queue", deviceId, phone])
]);
```

### Database Indexes

**Critical Indexes:**
```sql
CREATE INDEX idx_ai_whatsapp_device_phone
ON ai_whatsapp(device_id, prospect_num);

CREATE INDEX idx_ai_whatsapp_date
ON ai_whatsapp(date_insert DESC);
```

---

## Summary

This detailed flow shows how the system:

1. **Step 5** - Generates contextually aware AI responses using OpenRouter API with conversation history and custom prompts
2. **Step 6** - Sends the response through WhatsApp providers (WAHA, Wablas, WhCenter) with proper formatting
3. **Step 7** - Delivers the message to the user's device via WhatsApp's infrastructure with status tracking

The entire process typically completes in 5-9 seconds, providing a responsive conversational experience for WhatsApp users.
