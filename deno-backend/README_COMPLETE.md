# Complete Webhook Handler - WAHA Only

## 📁 File: `COMPLETE_WEBHOOK.ts`

**100% Feature Parity with Go Backend** - Focused on WAHA Provider Only

---

## ✅ Features Implemented

### Core Flow Processing
- ✅ Device lookup with fallback (webhook_id → id_device)
- ✅ Flow type detection (Whatsapp Bot vs Chatbot AI)
- ✅ Complete flow execution engine with all 9 node types
- ✅ Waiting for reply and resume logic
- ✅ Stage configuration with dynamic column updates
- ✅ Condition branching (equal, contains, match, default)
- ✅ Conversation history tracking (conv_last)

### Node Types Supported
1. **send_message** - Send text messages
2. **send_image** - Send images
3. **send_audio** - Send audio files
4. **send_video** - Send videos
5. **delay** - Pause execution
6. **waiting_reply** - Wait for user response (pauses flow)
7. **waiting_times** - Wait with timeout
8. **stage** - Update conversation stage with dynamic columns
9. **conditions** - Branching logic

### Customer Templates
- ✅ DETAIL CUSTOMER
- ✅ DETAIL COD
- ✅ DETAIL WAGES
- ✅ DETAIL CASH

### WAHA Provider Features
- ✅ Normal contact format (@c.us)
- ✅ LID mapping support (@lid)
- ✅ PushName extraction
- ✅ Group message filtering
- ✅ Phone number validation (601 prefix)
- ✅ Text messages
- ✅ Image messages
- ✅ Video messages (MP4)
- ✅ Audio messages (MP3)

### Built-in Features
- ✅ 4-second message debouncing with Deno KV
- ✅ Message queue accumulation
- ✅ Timer reset on new messages
- ✅ Webhook verification (hub.challenge)
- ✅ Health check endpoint

---

## 🚀 Deployment

### 1. Copy File to Deno Deploy

Copy the entire content of `COMPLETE_WEBHOOK.ts` to your Deno Deploy project.

### 2. Set Environment Variables

```bash
SUPABASE_URL=https://bjnjucwpwdzgsnqmpmff.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DEBOUNCE_DELAY_MS=4000
SERVER_URL=https://pening-bot.deno.dev
WAHA_API_URL=https://waha-plus-production-705f.up.railway.app
```

### 3. Deploy

- Entry point: `COMPLETE_WEBHOOK.ts`
- Production branch: `main`

---

## 📋 Webhook URL Pattern

```
https://pening-bot.deno.dev/{device_id}/{webhook_id}
```

### Example:
```
https://pening-bot.deno.dev/FakhriAidilTLW-001/UserChatBot_FakhriAidilTLW-001
```

---

## 🧪 Testing

### Health Check
```bash
curl https://pening-bot.deno.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "dev-muse-automaton-complete",
  "debounce_delay": "4000ms",
  "features": [
    "Flow Execution Engine",
    "Waiting for Reply",
    "Stage Configuration",
    "Condition Branching",
    "WAHA Provider Support",
    "4-Second Debouncing"
  ]
}
```

### Webhook Verification (GET)
```bash
curl "https://pening-bot.deno.dev/FakhriAidilTLW-001/UserChatBot_FakhriAidilTLW-001?hub.challenge=test123"
```

Expected: Returns `test123`

### Test Message (POST)
Send a WhatsApp message to your device through WAHA. The webhook should:
1. Receive the message
2. Queue it for 4 seconds
3. Process through flow engine
4. Send response via WAHA

---

## 📊 Database Tables Used

| Table | Purpose |
|-------|---------|
| `device_setting` | Device configurations |
| `chatbot_flows` | Flow definitions |
| `wasapbot` | Whatsapp Bot conversations |
| `ai_whatsapp` | Chatbot AI conversations |
| `stagesetvalue` | Stage configurations |

---

## 🔍 Flow Execution Logic

### New Conversation
1. Webhook receives message
2. Queue for 4-second debouncing
3. Get device from database
4. Get active flows
5. Determine flow type (Whatsapp Bot vs Chatbot AI)
6. Create new conversation in respective table
7. Execute flow from start node

### Existing Conversation (waiting_for_reply = true)
1. Webhook receives message
2. Queue for 4-second debouncing
3. Get existing conversation
4. Reset waiting_for_reply to false
5. **Resume from current_node_id**
6. Continue executing remaining nodes

### Stage Configuration
When flow hits a `stage` node:
1. Check `stagesetvalue` table for configuration
2. If `type_inputdata = "Set"`: Use hardcoded value
3. If `type_inputdata = "Input"`: Extract from last user message in conv_last
4. Update conversation with stage + dynamic column

### Condition Branching
When flow hits a `conditions` node:
1. Check all outgoing edges for condition matching
2. Match types: `equal`, `contains`, `match`, `default`
3. Follow first matched condition
4. If no match, follow `default` edge
5. If no default, randomly select edge

---

## 🔧 Key Functions

### Flow Processing
- `processIncomingMessage()` - Main entry point
- `executeFlow()` - Start flow from beginning
- `resumeFlow()` - Resume from waiting_for_reply
- `executeFromNode()` - Recursive node execution
- `executeNode()` - Execute single node by type
- `findNextNode()` - Navigate with condition matching

### Message Handling
- `parseWebhookPayload()` - Parse WAHA webhook
- `queueMessageForDebouncing()` - 4-second queue
- `sendWahaMessage()` - Send via WAHA API

### Utilities
- `determineFlowType()` - Detect flow type
- `findStartingNode()` - Find entry point
- `updateConvLast()` - Track conversation history
- `normalizeColumnName()` - Map UI names to DB columns
- `populateCustomerTemplate()` - Replace templates

---

## 📝 Line Count

**Total:** 1,449 lines of production-ready TypeScript

---

## ✅ Comparison with Go Backend

| Feature | Go Backend | Deno COMPLETE_WEBHOOK.ts |
|---------|-----------|------------------------|
| Flow Execution | ✅ | ✅ |
| All 9 Node Types | ✅ | ✅ |
| Waiting for Reply | ✅ | ✅ |
| Stage Configuration | ✅ | ✅ |
| Condition Branching | ✅ | ✅ |
| Customer Templates | ✅ | ✅ |
| WAHA Provider | ✅ | ✅ |
| Message Debouncing | External Deno | Built-in Deno KV ✅ |
| Device Lookup Fallback | ✅ | ✅ |
| Conversation History | ✅ | ✅ |

**Result:** 100% Feature Parity + Built-in Debouncing

---

## 🎉 Ready for Production!

This file is a complete, production-ready webhook handler that replicates 100% of your Go backend functionality, optimized for WAHA provider only.

**Benefits:**
- ✅ No external dependencies for debouncing
- ✅ Serverless (0 cost when idle)
- ✅ Auto-scaling
- ✅ TypeScript type safety
- ✅ Single file deployment
- ✅ Built-in Deno KV queue

Just deploy and update your WhatsApp webhook URL!
