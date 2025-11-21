# WhatsApp Bot Commands Guide

## How to Trigger Commands

All commands are sent via **WhatsApp messages** from your admin/business WhatsApp number (the connected device).

## Command Types

### 1️⃣ Direct Reply Commands (Chat with Customer)

These commands are sent **directly in the customer's chat** by replying to their conversation.

#### **`cmd`** - Activate Human Mode
**How to use:**
1. Open WhatsApp on your connected device
2. Go to the customer's chat
3. Type: `cmd`
4. Send the message

**What happens:**
- Sets `human = 1` for this customer
- Bot stops responding automatically
- You (human) take over the conversation
- Customer's next messages won't trigger AI

**Example:**
```
Customer: "Hello, interested in your product"
Bot: "Hi! Welcome to our store..."
[You want to take over personally]
You type: cmd
✅ Human mode activated - you can now reply manually
```

---

#### **`dmc`** - Deactivate Human Mode (back to AI)
**How to use:**
1. Open WhatsApp on your connected device
2. Go to the customer's chat
3. Type: `dmc`
4. Send the message

**What happens:**
- Sets `human = null` for this customer
- Bot resumes automatic responses
- AI takes over again

**Example:**
```
[After handling customer manually]
You type: dmc
✅ AI mode activated - bot will respond automatically again
Customer: "What's the price?"
Bot: "Here are our prices..." (AI responds)
```

---

### 2️⃣ Remote Commands (Control from Any Chat)

These commands allow you to control **other customers'** conversations without opening their chat.

#### **`/[phone number]`** - Activate Human Mode for Another Customer
**How to use:**
1. Open WhatsApp on your **personal phone** (NOT the connected business device)
2. Send a message **TO your connected business WhatsApp number**
3. Type: `/60123456789` (customer's phone number)
4. Send the message

**What happens:**
- Your connected business WhatsApp receives the command
- Sets `human = 1` for the specified customer phone number
- Bot stops responding to that customer
- You can now manually reply to them from the business WhatsApp

**Example:**
```
[From your personal phone]
You send TO business WhatsApp: /60123456789
✅ Human mode activated for +60123456789
[Now that customer's messages won't trigger AI]
```

---

#### **`?[phone number]`** - Deactivate Human Mode for Another Customer
**How to use:**
1. Open WhatsApp on your **personal phone** (NOT the connected business device)
2. Send a message **TO your connected business WhatsApp number**
3. Type: `?60123456789` (customer's phone number)
4. Send the message

**What happens:**
- Your connected business WhatsApp receives the command
- Sets `human = null` for the specified customer phone number
- Bot resumes automatic responses for that customer

**Example:**
```
[From your personal phone]
You send TO business WhatsApp: ?60123456789
✅ AI mode activated for +60123456789
[Now that customer gets AI responses again]
```

---

### 3️⃣ Special Commands

#### **`DELETE`** - Delete Your Test Conversation
**How to use:**
1. When testing the bot from your **personal phone** (acting as customer)
2. In the chat with your **business WhatsApp**
3. Type: `DELETE`
4. Send the message

**What happens:**
- Deletes YOUR conversation from database
- Bot sends: "Sudah Delete Data Anda" back to you
- Fresh start - you can test the bot from scratch again
- Useful for: Testing different conversation flows

**Example:**
```
[From your personal phone chatting with business WhatsApp]
You: Hello (testing bot)
Bot: Hi! Welcome...
You: DELETE (want to test again from start)
Bot: Sudah Delete Data Anda
✅ Your conversation is deleted
✅ You can now send "Hello" again for fresh test
```

---

#### **`#[phone number]`** - Trigger Manual Flow (Auto Message)
**How to use:**
1. Open WhatsApp on your **personal phone** (NOT the connected business device)
2. Send a message **TO your connected business WhatsApp number**
3. Type: `#60123456789` (customer's phone number)
4. Send the message

**What happens:**
- Your connected business WhatsApp receives the command
- Bot sends "Teruskan" (continuation) to that customer
- Bot processes with AI automatically
- Useful for manually pushing the conversation forward

**Example:**
```
[From your personal phone]
You send TO business WhatsApp: #60123456789
✅ Bot sends "Teruskan" to customer
✅ AI processes and responds
```

---

#### **`%[phone number] Your message here`** - Send Custom Message via Bot
**How to use:**
1. Open WhatsApp on your **personal phone** (NOT the connected business device)
2. Send a message **TO your connected business WhatsApp number**
3. Type: `%60123456789 Hi, this is a custom message from me`
4. Send the message

**What happens:**
- Your connected business WhatsApp receives the command
- Bot sends YOUR custom message to the specified customer
- Bot processes the message and AI generates appropriate response
- Useful for initiating conversation or testing

**Example:**
```
[From your personal phone]
You send TO business WhatsApp: %60123456789 Hi, are you interested in our product?
✅ Bot sends to customer: "Hi, are you interested in our product?"
✅ Bot processes and generates AI response
```

---

#### **`![phone number]`** - Cancel/Stop All Scheduled Sequence Messages
**How to use:**
1. Open WhatsApp on your **personal phone** (NOT the connected business device)
2. Send a message **TO your connected business WhatsApp number**
3. Type: `!60123456789` (customer's phone number)
4. Send the message

**What happens:**
- Your connected business WhatsApp receives the command
- Bot fetches all scheduled sequence messages for that customer
- Deletes ALL scheduled messages from WhatsApp Center API
- Updates database status to 'cancelled'
- Clears `sequence_stage` column in database
- Customer will no longer receive any scheduled sequence messages
- Useful for: Stopping sequences when customer unsubscribes or requests to stop

**Example:**
```
[From your personal phone]
You send TO business WhatsApp: !60123456789
✅ Bot cancels all scheduled messages for +60123456789
✅ Database updated - sequence_stage cleared
✅ Customer removed from sequence
```

**Use cases:**
- Customer requests to stop receiving messages
- Customer wants to unsubscribe from sequence
- You want to manually stop automation for a lead
- Lead converted and no longer needs nurturing sequence

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    WHATSAPP COMMANDS FLOW                   │
└─────────────────────────────────────────────────────────────┘

HOW COMMANDS WORK:

Direct Commands (in customer chat):
┌──────────────────┐         ┌─────────────────┐
│  Business        │  Type:  │  Customer Chat  │
│  WhatsApp        │  cmd    │  +60123456789   │
│  (Connected)     │  ─────→ │                 │
└──────────────────┘         └─────────────────┘
                             Result: Human mode ON


Remote Commands (from your personal phone):
┌──────────────────┐         ┌─────────────────┐         ┌──────────────┐
│  Your Personal   │  Send:  │  Business       │  Sets:  │  Customer    │
│  Phone           │  /phone │  WhatsApp       │  human  │  +60123...   │
│  (Your 2nd WA)   │  ─────→ │  (Connected)    │  ─────→ │  mode ON     │
└──────────────────┘         └─────────────────┘         └──────────────┘


IMPORTANT: Two Different Methods
═══════════════════════════════════════════════════════════

Method 1: DIRECT IN CUSTOMER CHAT (from business WhatsApp)
┌─────────────────────────┐
│  Type: cmd              │  →  Human takes over (current chat)
│  Type: dmc              │  →  AI takes over (current chat)
│  Type: DELETE           │  →  Delete conversation (current chat)
└─────────────────────────┘
✅ Use ONLY when you're IN the customer's chat on business WhatsApp


Method 2: REMOTE CONTROL (from your personal phone TO business WhatsApp)
┌──────────────────────────────────────────┐
│  Send TO business WA:                    │
│  /60123456789                            │  →  Human mode for that number
│  ?60123456789                            │  →  AI mode for that number
│  #60123456789                            │  →  Trigger auto flow
│  %60123456789 Custom message             │  →  Send custom message
│  !60123456789                            │  →  Cancel all scheduled sequences
└──────────────────────────────────────────┘
✅ Use when you want to control from YOUR phone (not business WhatsApp)
```

---

## Important Notes

### ⚠️ Understanding Command Sources

**Two ways to send commands:**

**Method 1: Direct from Business WhatsApp** (`cmd`, `dmc`)
- ✅ Open business WhatsApp (connected device)
- ✅ Go INTO the customer's chat
- ✅ Type command directly in their chat
- ✅ Used for: current conversation control

**Method 1b: Customer-side Command** (`DELETE`)
- ✅ Customer (or you testing as customer) sends this command
- ✅ Sent TO business WhatsApp in their chat
- ✅ Deletes their own conversation
- ✅ Used for: testing/resetting test conversations

**Method 2: Remote from Personal Phone** (`/`, `?`, `#`, `%`, `!`)
- ✅ Open YOUR personal WhatsApp (your 2nd phone)
- ✅ Send command TO your business WhatsApp number
- ✅ Include customer's phone number in command
- ✅ Used for: controlling other customers remotely

**IMPORTANT:**
- ❌ Customers **CANNOT** trigger these commands
- ❌ Commands only work when sent from/to the connected business account
- ✅ Remote commands must be sent **TO** your business WhatsApp, not from it

### 📋 Phone Number Format

When using `/` and `?` commands, use the full phone number as stored in database:

- ✅ `60123456789` (Malaysia)
- ✅ `60123456789@c.us` (with WhatsApp suffix)
- ✅ `1234567890` (as it appears in database)

Check the `prospect_num` field in `ai_whatsapp` table to see exact format.

### 🔍 How to Know Current Status?

**Option 1: Check Dashboard**
- Go to Chatbot AI page
- Look at the STATUS column
- Shows "AI" (green) or "Human" (orange)

**Option 2: Check Database**
```sql
SELECT prospect_num, prospect_name, human
FROM ai_whatsapp
WHERE device_id = 'your_device_id';
```
- `human = null` → AI mode
- `human = 1` → Human mode

---

## Common Use Cases

### Scenario 1: Customer Needs Personal Attention
```
1. Customer sends: "I want to speak to a real person"
2. You see notification
3. You type in their chat: cmd
4. You reply personally: "Hi, I'm the owner. How can I help?"
5. Continue manual conversation
6. When done, type: dmc (to return to AI)
```

### Scenario 2: Manage Multiple Customers Remotely
```
From your personal phone, send TO business WhatsApp:

You send: /60111111111    (Customer A - human mode)
You send: /60222222222    (Customer B - human mode)
You send: /60333333333    (Customer C - human mode)

✅ All three are now in human mode
✅ Now open business WhatsApp and reply to them manually

Later, when done, from your personal phone TO business WhatsApp:
You send: ?60111111111    (Customer A - back to AI)
You send: ?60222222222    (Customer B - back to AI)
You send: ?60333333333    (Customer C - back to AI)

✅ All three are back to AI mode
```

### Scenario 3: Trigger Manual Flow
```
Customer is stuck or not responding, you want to push conversation:

From your personal phone, send TO business WhatsApp:
You send: #60123456789

✅ Bot sends "Teruskan" to customer
✅ AI processes and continues conversation
```

### Scenario 4: Send Custom Message via Bot
```
You want to send a specific message and let AI handle response:

From your personal phone, send TO business WhatsApp:
You send: %60123456789 Hi Ali, thanks for your interest! Are you ready to order?

✅ Bot sends your message to customer
✅ When customer replies, AI generates response
✅ Useful for starting conversations or testing bot responses
```

### Scenario 5: Testing Bot - Reset Your Test Data
```
You're testing the bot from your personal phone:

[From personal phone]
You: Hello
Bot: Hi! Welcome to our store...
You: What's the price?
Bot: Our prices start from...

[Want to test from beginning again]
You: DELETE
Bot: Sudah Delete Data Anda

✅ Your conversation deleted
✅ Can now send "Hello" again for fresh test
✅ Useful for testing different conversation paths
```

### Scenario 6: Stop Scheduled Sequence Messages
```
Customer is enrolled in a 7-day nurturing sequence but requests to stop:

Customer: Please stop sending me messages
You: Sure, let me cancel all scheduled messages

[From your personal phone, send TO business WhatsApp]
You send: !60123456789

✅ Bot cancels all 5 remaining scheduled messages
✅ Clears sequence_stage from database
✅ Customer will not receive any more automated sequence messages
✅ You can still manually message them if needed
```

**Another example - Lead converted:**
```
Customer already purchased, no need for nurturing sequence:

[From your personal phone, send TO business WhatsApp]
You send: !60123456789

✅ Stops all scheduled follow-up messages
✅ Customer removed from sequence automation
✅ You can now handle them manually or enroll in different sequence
```

---

## Testing Commands

### Test Setup:
1. Use your own phone number as a test customer
2. Send a message to your business WhatsApp
3. Let AI respond
4. Try the commands

### Test Commands:
```bash
# Step 1: Start conversation
From your personal phone → "Hello"
Bot responds → "Hi! Welcome..."

# Step 2: Activate human mode (from business phone)
From business phone in that chat → "cmd"
✅ Human mode activated

# Step 3: Send message (won't trigger AI)
From your personal phone → "What's the price?"
[No AI response - you're in control]

# Step 4: Deactivate human mode
From business phone in that chat → "dmc"
✅ AI mode activated

# Step 5: Test AI again
From your personal phone → "What's the price?"
Bot responds → "Here are our prices..."
```

---

## Webhook Logs

When you send commands, check the webhook logs (Deno Deploy dashboard):

```
✅ Set human mode to 1 for +60123456789
✅ Set human mode to null for +60123456789
⚠️  Human mode active for +60123456789, skipping AI processing
```

---

## Summary Table

| Command | Where to Send | What it Does | Example |
|---------|--------------|--------------|---------|
| `cmd` | Customer's chat | Activate human mode for current chat | `cmd` |
| `dmc` | Customer's chat | Deactivate human mode for current chat | `dmc` |
| `/[phone]` | Any chat | Activate human mode for phone number | `/60123456789` |
| `?[phone]` | Any chat | Deactivate human mode for phone number | `?60123456789` |
| `![phone]` | Any chat | Cancel all scheduled sequence messages | `!60123456789` |
| `DELETE` | Customer's chat | Delete conversation | `DELETE` |
| `#[phone]` | Any chat | Trigger auto flow (send "Teruskan") | `#60123456789` |
| `%[phone] [msg]` | Any chat | Send custom message via bot | `%60123456789 Hello!` |

---

## Troubleshooting

**Command not working?**
- ✅ Check you're sending from the **connected business WhatsApp**
- ✅ Check phone number format matches database
- ✅ Check webhook logs for errors
- ✅ Verify device_id matches in database

**AI still responding in human mode?**
- ✅ Check database: `SELECT human FROM ai_whatsapp WHERE prospect_num = '+60123456789'`
- ✅ Should show `1` for human mode
- ✅ Check webhook deployed with latest code

**Can't find customer's phone number?**
```sql
SELECT prospect_num, prospect_name FROM ai_whatsapp
WHERE prospect_name LIKE '%John%';
```
