# Real Simulation: User Message → Bot Reply

This document shows a complete real-world example of how the system processes a message from start to finish, including all database operations.

---

## Scenario

**User:** John Doe (Phone: +6281234567890)
**Device:** `device-real-estate-001`
**Prompt:** Real Estate Lead Qualifier
**Conversation:** First-time user (new conversation)

---

## Initial Database State

### Table: `device_setting`
```sql
device_id: "device-real-estate-001"
webhook_id: "webhook-real-estate-001"
instance: "default"
provider: "waha"
api_key: "https://waha.example.com"
api_key_option: "openai/gpt-4.1"
user_id: "uuid-user-123"
phone_number: "+6281111111111"
```

### Table: `prompts`
```sql
id: "uuid-prompt-456"
device_id: "device-real-estate-001"
niche: "Real Estate"
prompts_name: "Real Estate Lead Qualifier"
prompts_data: "You are a professional real estate assistant. Your role is to:
1. Greet potential buyers warmly
2. Ask about their property preferences
3. Qualify their budget and timeline
4. Schedule property viewings
Be friendly, professional, and helpful."
user_id: "uuid-user-123"
created_at: "2025-11-01"
updated_at: "2025-11-01"
```

### Table: `ai_whatsapp`
```sql
(empty - no existing conversation for this phone number)
```

---

## Complete Message Flow

### Step 1: User Sends Message

**Time:** 14:30:00.000

**User Action:**
```
John opens WhatsApp and types: "Hello, I'm looking for a house"
```

**WhatsApp → WAHA:**
```
14:30:00.100 - WhatsApp sends message to WAHA server
```

---

### Step 2: WAHA Sends Webhook

**Time:** 14:30:00.200

**WAHA → Deno Backend:**
```http
POST https://pening-bot.deno.dev/device-real-estate-001/webhook-real-estate-001
Content-Type: application/json

{
  "event": "message",
  "session": "default",
  "payload": {
    "from": "6281234567890@c.us",
    "body": "Hello, I'm looking for a house",
    "name": "John Doe",
    "timestamp": 1699534200
  }
}
```

**Backend Log:**
```
📥 Webhook: POST /device-real-estate-001/webhook-real-estate-001
```

---

### Step 3: Webhook Handler Processes Request

**Time:** 14:30:00.300

**File:** `deno-backend/handlers/webhook.ts`

**Database Query 1 - Verify Device:**
```sql
SELECT * FROM device_setting
WHERE device_id = 'device-real-estate-001'
  AND webhook_id = 'webhook-real-estate-001'
LIMIT 1;
```

**Query Result:**
```json
{
  "device_id": "device-real-estate-001",
  "webhook_id": "webhook-real-estate-001",
  "instance": "default",
  "provider": "waha",
  "api_key": "https://waha.example.com",
  "api_key_option": "openai/gpt-4.1",
  "user_id": "uuid-user-123"
}
```

**Backend Log:**
```
✅ Device found: device-real-estate-001 (Provider: waha)
📨 Raw webhook payload: {...}
✅ Parsed message from 6281234567890 (John Doe): Hello, I'm looking for a house
```

**Webhook Parser Output:**
```javascript
{
  phone: "6281234567890",
  message: "Hello, I'm looking for a house",
  name: "John Doe"
}
```

---

### Step 4: Queue for Debouncing

**Time:** 14:30:00.400

**File:** `deno-backend/services/debounce.ts`

**Action:** Store in Deno KV database
```javascript
Key: ["message_queue", "device-real-estate-001", "6281234567890"]
Value: {
  deviceId: "device-real-estate-001",
  webhookId: "webhook-real-estate-001",
  phone: "6281234567890",
  name: "John Doe",
  provider: "waha",
  messages: [
    {
      message: "Hello, I'm looking for a house",
      timestamp: 1699534200400
    }
  ],
  lastMessageTime: 1699534200400,
  timerScheduled: 1699534204400  // +4 seconds
}
```

**Backend Log:**
```
🆕 [device-real-estate-001/6281234567890] New queue created. Timer started (4000ms).
📬 Message queued for debouncing (4s delay)
```

**Response to WAHA:**
```json
{
  "success": true,
  "message": "Message queued for processing",
  "processed": true,
  "debounced": true
}
```

---

### Step 5: Wait for Debounce Timer

**Time:** 14:30:00.400 → 14:30:04.400

**Duration:** 4 seconds

**Purpose:** Wait to see if user sends more messages

*(User doesn't send any more messages)*

---

### Step 6: Timer Expires - Start Processing

**Time:** 14:30:04.400

**File:** `deno-backend/services/debounce.ts`

**Backend Log:**
```
⏰ [device-real-estate-001/6281234567890] Timer EXPIRED! Processing 1 messages...
📤 [device-real-estate-001/6281234567890] Processing combined message: Hello, I'm looking for a house
```

**Action:** Call `processFlowMessage()`

---

### Step 7: Flow Execution Starts

**Time:** 14:30:04.500

**File:** `deno-backend/services/flow-execution.ts`

**Backend Log:**
```
🔄 Processing AI chatbot message for device-real-estate-001/6281234567890
```

**Database Query 2 - Get Device:**
```sql
SELECT * FROM device_setting
WHERE device_id = 'device-real-estate-001'
  AND webhook_id = 'webhook-real-estate-001'
LIMIT 1;
```

**Query Result:** (Same as Step 3)

---

### Step 8: Load Prompt Configuration

**Time:** 14:30:04.600

**Database Query 3 - Get Prompt:**
```sql
SELECT * FROM prompts
WHERE device_id = 'device-real-estate-001'
LIMIT 1;
```

**Query Result:**
```json
{
  "id": "uuid-prompt-456",
  "device_id": "device-real-estate-001",
  "niche": "Real Estate",
  "prompts_name": "Real Estate Lead Qualifier",
  "prompts_data": "You are a professional real estate assistant. Your role is to:\n1. Greet potential buyers warmly\n2. Ask about their property preferences\n3. Qualify their budget and timeline\n4. Schedule property viewings\nBe friendly, professional, and helpful.",
  "user_id": "uuid-user-123",
  "created_at": "2025-11-01",
  "updated_at": "2025-11-01"
}
```

**Backend Log:**
```
✅ Found prompt: Real Estate Lead Qualifier
```

---

### Step 9: Check for Existing Conversation

**Time:** 14:30:04.700

**Database Query 4 - Get Conversation:**
```sql
SELECT * FROM ai_whatsapp
WHERE device_id = 'device-real-estate-001'
  AND prospect_num = '6281234567890'
ORDER BY date_insert DESC
LIMIT 1;
```

**Query Result:**
```
(no rows) - This is a new conversation
```

---

### Step 10: Create New Conversation

**Time:** 14:30:04.800

**Database Query 5 - Insert Conversation:**
```sql
INSERT INTO ai_whatsapp (
  device_id,
  prospect_num,
  prospect_name,
  niche,
  intro,
  stage,
  conv_current,
  conv_last,
  human,
  date_insert,
  user_id,
  detail
) VALUES (
  'device-real-estate-001',
  '6281234567890',
  'John Doe',
  'Real Estate',              -- FROM prompts.niche
  '',
  'active',
  'Hello, I''m looking for a house',
  '',
  0,
  '2025-11-11',
  'uuid-user-123',
  ''
) RETURNING *;
```

**Query Result:**
```json
{
  "id_prospect": 1,
  "device_id": "device-real-estate-001",
  "prospect_num": "6281234567890",
  "prospect_name": "John Doe",
  "niche": "Real Estate",
  "intro": "",
  "stage": "active",
  "conv_current": "Hello, I'm looking for a house",
  "conv_last": "",
  "human": 0,
  "date_insert": "2025-11-11",
  "user_id": "uuid-user-123",
  "detail": ""
}
```

**Backend Log:**
```
✅ New conversation created: 1
```

**Current State:**
```javascript
conversation = {
  id_prospect: 1,
  device_id: "device-real-estate-001",
  prospect_num: "6281234567890",
  prospect_name: "John Doe",
  niche: "Real Estate",
  stage: "active",
  conv_current: "Hello, I'm looking for a house",
  conv_last: "",  // EMPTY - no previous conversation
  human: 0
}
```

---

### Step 11: Generate AI Response

**Time:** 14:30:04.900

**File:** `deno-backend/services/ai.ts`

**Backend Log:**
```
🤖 Generating AI response with prompt: Real Estate Lead Qualifier
```

**Build Conversation History:**
```javascript
const conversationHistory = `Previous: \nCurrent: Hello, I'm looking for a house`;
```

**Build Flow Context:**
```javascript
const flowContext = `You are a professional real estate assistant. Your role is to:
1. Greet potential buyers warmly
2. Ask about their property preferences
3. Qualify their budget and timeline
4. Schedule property viewings
Be friendly, professional, and helpful.`;
```

**Build System Prompt:**
```javascript
const systemPrompt = `You are a helpful AI assistant in a WhatsApp conversation.

Flow Context: You are a professional real estate assistant. Your role is to:
1. Greet potential buyers warmly
2. Ask about their property preferences
3. Qualify their budget and timeline
4. Schedule property viewings
Be friendly, professional, and helpful.

Your role is to:
1. Respond naturally based on the conversation context
2. Follow any instructions provided in the flow context
3. Keep responses concise and appropriate for WhatsApp (avoid very long messages)
4. Be friendly and professional

Previous Conversation:
Previous:
Current: Hello, I'm looking for a house
`;
```

---

### Step 12: Call OpenRouter API

**Time:** 14:30:05.000

**API Request:**
```http
POST https://openrouter.ai/api/v1/chat/completions
Content-Type: application/json
Authorization: Bearer sk-or-v1-xxxxxxxxxxxxx
HTTP-Referer: https://dev-muse-automaton.deno.dev
X-Title: Dev Muse Automaton

{
  "model": "openai/gpt-4.1",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful AI assistant in a WhatsApp conversation.\n\nFlow Context: You are a professional real estate assistant. Your role is to:\n1. Greet potential buyers warmly\n2. Ask about their property preferences\n3. Qualify their budget and timeline\n4. Schedule property viewings\nBe friendly, professional, and helpful.\n\nYour role is to:\n1. Respond naturally based on the conversation context\n2. Follow any instructions provided in the flow context\n3. Keep responses concise and appropriate for WhatsApp (avoid very long messages)\n4. Be friendly and professional\n\nPrevious Conversation:\nPrevious: \nCurrent: Hello, I'm looking for a house\n"
    },
    {
      "role": "user",
      "content": "Hello, I'm looking for a house"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 500
}
```

**Backend Log:**
```
🤖 AI Request: openai/gpt-4.1
```

---

### Step 13: OpenRouter Responds

**Time:** 14:30:07.200 (2.2 seconds later)

**API Response:**
```json
{
  "id": "chatcmpl-abc123xyz",
  "object": "chat.completion",
  "created": 1699534207,
  "model": "openai/gpt-4.1",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello John! 👋 I'd be delighted to help you find your perfect home!\n\nTo better assist you, could you tell me:\n1. What type of property are you looking for? (House, apartment, villa, etc.)\n2. How many bedrooms do you need?\n3. What's your preferred location or area?\n4. Do you have a budget range in mind?\n\nFeel free to share as much or as little detail as you're comfortable with! 🏡"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 287,
    "completion_tokens": 98,
    "total_tokens": 385
  }
}
```

**Backend Log:**
```
✅ AI Response: Hello John! 👋 I'd be delighted to help you find your perfect home!

To better assist you...
```

**Extracted Response:**
```javascript
const response = "Hello John! 👋 I'd be delighted to help you find your perfect home!\n\nTo better assist you, could you tell me:\n1. What type of property are you looking for? (House, apartment, villa, etc.)\n2. How many bedrooms do you need?\n3. What's your preferred location or area?\n4. Do you have a budget range in mind?\n\nFeel free to share as much or as little detail as you're comfortable with! 🏡";
```

---

### Step 14: Send Response via WhatsApp

**Time:** 14:30:07.300

**File:** `deno-backend/services/whatsapp-provider.ts`

**API Request to WAHA:**
```http
POST https://waha.example.com/api/sendText
Content-Type: application/json

{
  "session": "default",
  "chatId": "6281234567890@c.us",
  "text": "Hello John! 👋 I'd be delighted to help you find your perfect home!\n\nTo better assist you, could you tell me:\n1. What type of property are you looking for? (House, apartment, villa, etc.)\n2. How many bedrooms do you need?\n3. What's your preferred location or area?\n4. Do you have a budget range in mind?\n\nFeel free to share as much or as little detail as you're comfortable with! 🏡"
}
```

**WAHA Response:**
```json
{
  "id": "true_6281234567890@c.us_3EB0XYZ789ABC",
  "timestamp": 1699534207,
  "status": "sent"
}
```

**Backend Log:**
```
✅ WAHA message sent to 6281234567890
```

---

### Step 15: Update Conversation with Bot Response

**Time:** 14:30:07.400

**Database Query 6 - Update with Bot Response:**
```sql
UPDATE ai_whatsapp
SET conv_last = 'Hello John! 👋 I''d be delighted to help you find your perfect home!

To better assist you, could you tell me:
1. What type of property are you looking for? (House, apartment, villa, etc.)
2. How many bedrooms do you need?
3. What''s your preferred location or area?
4. Do you have a budget range in mind?

Feel free to share as much or as little detail as you''re comfortable with! 🏡'
WHERE id_prospect = 1;
```

**Backend Log:**
```
💬 Saved bot response to conv_last for conversation 1
✅ AI chatbot processing complete for 6281234567890
```

---

### Step 16: Clear Debounce Queue

**Time:** 14:30:07.500

**Action:** Delete from Deno KV
```javascript
Key: ["message_queue", "device-real-estate-001", "6281234567890"]
Action: DELETE
```

**Backend Log:**
```
✅ [device-real-estate-001/6281234567890] Flow processing complete: {success: true, responded: true}
🗑️ [device-real-estate-001/6281234567890] Queue cleared
```

---

### Step 17: User Receives Message

**Time:** 14:30:07.800

**WhatsApp delivers message to John's phone**

**John sees:**
```
Real Estate Bot (14:30)
Hello John! 👋 I'd be delighted to help you find your perfect home!

To better assist you, could you tell me:
1. What type of property are you looking for? (House, apartment, villa, etc.)
2. How many bedrooms do you need?
3. What's your preferred location or area?
4. Do you have a budget range in mind?

Feel free to share as much or as little detail as you're comfortable with! 🏡
```

---

## Final Database State After First Message

### Table: `ai_whatsapp`
```sql
id_prospect: 1
device_id: "device-real-estate-001"
prospect_num: "6281234567890"
prospect_name: "John Doe"
niche: "Real Estate"                    ← FROM prompts.niche
intro: ""
stage: "active"
conv_current: "Hello, I'm looking for a house"    ← USER MESSAGE
conv_last: "Hello John! 👋 I'd be delighted..."   ← BOT RESPONSE
human: 0
date_insert: "2025-11-11"
user_id: "uuid-user-123"
detail: ""
```

---

## Second Message Flow (User Replies)

### User Sends Second Message

**Time:** 14:31:00.000

**User Action:**
```
John types: "I need a 3 bedroom house in Jakarta, budget around 2 billion rupiah"
```

### Complete Flow (Abbreviated)

**14:31:00.100** - WAHA receives message
**14:31:00.200** - Webhook POST to backend
**14:31:00.300** - Verify device ✅
**14:31:00.400** - Queue for debouncing
**14:31:04.400** - Timer expires
**14:31:04.500** - Start processing
**14:31:04.600** - Load device ✅
**14:31:04.700** - Load prompt ✅

---

### Get Existing Conversation

**14:31:04.800**

**Database Query 7 - Get Conversation:**
```sql
SELECT * FROM ai_whatsapp
WHERE device_id = 'device-real-estate-001'
  AND prospect_num = '6281234567890'
ORDER BY date_insert DESC
LIMIT 1;
```

**Query Result:**
```json
{
  "id_prospect": 1,
  "device_id": "device-real-estate-001",
  "prospect_num": "6281234567890",
  "prospect_name": "John Doe",
  "niche": "Real Estate",
  "stage": "active",
  "conv_current": "Hello, I'm looking for a house",
  "conv_last": "Hello John! 👋 I'd be delighted...",  ← BOT'S PREVIOUS RESPONSE
  "human": 0
}
```

**Conversation found!** No need to create new one.

---

### Update Conversation

**14:31:04.900**

**Database Query 8 - Update Conversation:**
```sql
UPDATE ai_whatsapp
SET
  conv_last = 'Hello, I''m looking for a house',           ← MOVE conv_current TO conv_last
  conv_current = 'I need a 3 bedroom house in Jakarta, budget around 2 billion rupiah'  ← NEW MESSAGE
WHERE id_prospect = 1;
```

**Backend Log:**
```
📝 Updated conversation 1: moved current to last, saved new message
```

**New State:**
```javascript
conversation = {
  id_prospect: 1,
  conv_current: "I need a 3 bedroom house in Jakarta, budget around 2 billion rupiah",
  conv_last: "Hello, I'm looking for a house",  ← USER'S FIRST MESSAGE
  // ... other fields
}
```

**⚠️ IMPORTANT NOTE:**
At this point, `conv_last` contains the USER's first message, NOT the bot's response!
This is correct because we moved `conv_current` → `conv_last`.

---

### Generate AI Response (Second Time)

**14:31:05.000**

**Build Conversation History:**
```javascript
const conversationHistory = `Previous: Hello, I'm looking for a house
Current: I need a 3 bedroom house in Jakarta, budget around 2 billion rupiah`;
```

**AI now has context:**
- User's first message: "Hello, I'm looking for a house"
- User's current message: "I need a 3 bedroom house in Jakarta..."

**OpenRouter API Call:**
```http
POST https://openrouter.ai/api/v1/chat/completions

{
  "model": "openai/gpt-4.1",
  "messages": [
    {
      "role": "system",
      "content": "... [same system prompt with flow context] ...\n\nPrevious Conversation:\nPrevious: Hello, I'm looking for a house\nCurrent: I need a 3 bedroom house in Jakarta, budget around 2 billion rupiah"
    },
    {
      "role": "user",
      "content": "I need a 3 bedroom house in Jakarta, budget around 2 billion rupiah"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 500
}
```

---

### AI Response (Second)

**14:31:07.200**

**OpenRouter Response:**
```json
{
  "choices": [
    {
      "message": {
        "content": "Excellent! 🏠 A 3-bedroom house in Jakarta with a budget of 2 billion rupiah gives us great options!\n\nWhich area of Jakarta do you prefer?\n• South Jakarta (Kebayoran, Pondok Indah)\n• Central Jakarta (Menteng, Tanah Abang)\n• West Jakarta (Kebon Jeruk, Tanjung Duren)\n• East Jakarta (Cipinang, Klender)\n• North Jakarta (Kelapa Gading, PIK)\n\nAlso, when are you planning to move? This helps me prioritize properties for you! 📅"
      }
    }
  ]
}
```

---

### Send Second Response

**14:31:07.300**

**WAHA API Call:**
```http
POST https://waha.example.com/api/sendText

{
  "session": "default",
  "chatId": "6281234567890@c.us",
  "text": "Excellent! 🏠 A 3-bedroom house in Jakarta with a budget of 2 billion rupiah gives us great options!..."
}
```

---

### Update with Bot's Second Response

**14:31:07.400**

**Database Query 9 - Update with Bot Response:**
```sql
UPDATE ai_whatsapp
SET conv_last = 'Excellent! 🏠 A 3-bedroom house in Jakarta with a budget of 2 billion rupiah gives us great options!

Which area of Jakarta do you prefer?
• South Jakarta (Kebayoran, Pondok Indah)
• Central Jakarta (Menteng, Tanah Abang)
• West Jakarta (Kebon Jeruk, Tanjung Duren)
• East Jakarta (Cipinang, Klender)
• North Jakarta (Kelapa Gading, PIK)

Also, when are you planning to move? This helps me prioritize properties for you! 📅'
WHERE id_prospect = 1;
```

**Backend Log:**
```
💬 Saved bot response to conv_last for conversation 1
```

---

## Final Database State After Second Message

### Table: `ai_whatsapp` (Final State)
```sql
id_prospect: 1
device_id: "device-real-estate-001"
prospect_num: "6281234567890"
prospect_name: "John Doe"
niche: "Real Estate"
stage: "active"
conv_current: "I need a 3 bedroom house in Jakarta, budget around 2 billion rupiah"  ← USER'S SECOND MESSAGE
conv_last: "Excellent! 🏠 A 3-bedroom house in Jakarta..."                           ← BOT'S SECOND RESPONSE
human: 0
date_insert: "2025-11-11"
user_id: "uuid-user-123"
```

---

## Summary: How `conv_last` and `conv_current` Work

### Pattern for Each Message Exchange:

**BEFORE User Sends Message:**
```
conv_current: [Bot's last response]
conv_last: [Bot's previous response]
```

**Step 1: User Sends New Message**
```
→ Move conv_current to conv_last
→ Save user message to conv_current
```

**Step 2: Generate AI Response**
```
→ AI reads conv_last (user's previous message)
→ AI reads conv_current (user's current message)
→ AI has context of conversation
```

**Step 3: Send and Save Bot Response**
```
→ Send bot response via WhatsApp
→ Save bot response to conv_last (overwrite)
```

**Result:**
```
conv_current: [User's current message]
conv_last: [Bot's current response]
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ MESSAGE 1: "Hello, I'm looking for a house"                │
└─────────────────────────────────────────────────────────────┘

User Message
     ↓
[webhook.ts] Verify device → device_setting
     ↓
[debounce.ts] Store in Deno KV (4 sec wait)
     ↓
[flow-execution.ts] Get prompt → prompts table
     ↓                              (niche: "Real Estate")
     ↓                              (prompts_data: "You are...")
     ↓
Check conversation → ai_whatsapp (NOT FOUND)
     ↓
INSERT INTO ai_whatsapp:
  ├─ device_id: from webhook
  ├─ prospect_num: from webhook
  ├─ prospect_name: from webhook
  ├─ niche: from prompts.niche ★
  ├─ conv_current: "Hello, I'm looking for a house"
  └─ conv_last: ""
     ↓
[ai.ts] Generate response
  ├─ Context: prompts.prompts_data ★
  ├─ History: "Previous: \nCurrent: Hello..."
  └─ API: OpenRouter
     ↓
Response: "Hello John! 👋 I'd be delighted..."
     ↓
[whatsapp-provider.ts] Send via WAHA
     ↓
UPDATE ai_whatsapp:
  └─ conv_last: "Hello John! 👋 I'd be delighted..."
     ↓
User receives message ✅

DATABASE STATE:
conv_current: "Hello, I'm looking for a house"
conv_last: "Hello John! 👋 I'd be delighted..."


┌─────────────────────────────────────────────────────────────┐
│ MESSAGE 2: "I need 3 bedroom house..."                     │
└─────────────────────────────────────────────────────────────┘

User Message
     ↓
[webhook.ts] → [debounce.ts] → [flow-execution.ts]
     ↓
SELECT FROM ai_whatsapp (FOUND existing conversation)
     ↓
UPDATE ai_whatsapp:
  ├─ conv_last = conv_current  (move current to last)
  └─ conv_current = "I need 3 bedroom house..."
     ↓
[ai.ts] Generate response
  ├─ History: "Previous: Hello, I'm looking for a house
  │            Current: I need 3 bedroom house..."
  └─ AI has full context! ★
     ↓
Response: "Excellent! 🏠 A 3-bedroom house..."
     ↓
[whatsapp-provider.ts] Send via WAHA
     ↓
UPDATE ai_whatsapp:
  └─ conv_last = "Excellent! 🏠 A 3-bedroom house..."
     ↓
User receives message ✅

DATABASE STATE:
conv_current: "I need 3 bedroom house..."
conv_last: "Excellent! 🏠 A 3-bedroom house..."
```

---

## Key Takeaways

1. **`niche` comes from `prompts.niche`** ✅
2. **`prompts_data` is used as AI context** ✅
3. **`conv_last`** stores the most recent bot response
4. **`conv_current`** stores the most recent user message
5. **AI gets context** from both `conv_last` and `conv_current`
6. **Each exchange**, data shifts:
   - User message → `conv_current`
   - Previous `conv_current` → `conv_last`
   - Bot response → overwrites `conv_last`

---

## Total Processing Time

**Message 1:** ~7.5 seconds
- 4.0s debounce
- 0.5s database queries
- 2.3s AI generation
- 0.7s WAHA + updates

**Message 2:** ~7.2 seconds (similar)

**User Experience:** Nearly instant conversation!
