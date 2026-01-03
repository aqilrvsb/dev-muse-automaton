# Manual Flow Trigger - Quick Guide

## What is Manual Flow?

Manual flow allows you to **manually trigger the bot** to send messages to customers without them sending a message first. This is useful for:

- **Nudging** customers who haven't responded
- **Following up** on conversations
- **Testing** the bot behavior
- **Starting** new conversations proactively

---

## Two Ways to Trigger Manual Flow

### 1️⃣ **Auto Trigger** - Send Default "Teruskan" Message

**Command:** `#[phone number]`

**What it does:**
- Bot automatically sends "Teruskan" (Continue) to the customer
- AI processes the message and generates a response
- Good for generic follow-ups

**Example:**
```
You type in any WhatsApp chat: #60123456789
✅ Bot sends to customer: "Teruskan"
✅ AI generates response based on conversation context
```

---

### 2️⃣ **Custom Message** - Send Your Own Message

**Command:** `%[phone number] Your custom message here`

**What it does:**
- Bot sends YOUR custom message to the customer
- AI processes it as if customer sent it
- AI generates appropriate response
- Good for personalized follow-ups or testing

**Example:**
```
You type in any WhatsApp chat:
%60123456789 Hi Ali, have you decided on the package?

✅ Bot sends to customer: "Hi Ali, have you decided on the package?"
✅ AI processes and generates contextual response
```

---

## When to Use Each Method?

### Use **`#`** (Auto) When:
- ✅ You want a quick generic follow-up
- ✅ Customer conversation has stalled
- ✅ You want bot to continue naturally
- ✅ You're handling many customers at once

### Use **`%`** (Custom) When:
- ✅ You want to send a specific message
- ✅ You want to personalize the outreach
- ✅ You're testing bot responses to specific inputs
- ✅ You want to start a new conversation topic

---

## Step-by-Step: How to Trigger

### Method 1: Using `#` Command

**Step 1:** Open WhatsApp on your connected business device

**Step 2:** Go to ANY chat (recommend: admin group or saved messages)

**Step 3:** Type the command:
```
#60123456789
```

**Step 4:** Send the message

**Step 5:** Check customer's chat - bot will have sent "Teruskan"

---

### Method 2: Using `%` Command

**Step 1:** Open WhatsApp on your connected business device

**Step 2:** Go to ANY chat (recommend: admin group or saved messages)

**Step 3:** Type the command with your message:
```
%60123456789 Hi! Just following up on your interest in our products
```

**Step 4:** Send the message

**Step 5:** Check customer's chat - bot will have sent your custom message

---

## Real-World Examples

### Example 1: Follow Up After 24 Hours
```
Customer last messaged yesterday, no response today.

You type: %60111111111 Hi! Just checking in. Are you still interested?
✅ Bot sends personalized follow-up
✅ When customer replies, AI handles the conversation
```

### Example 2: Bulk Follow-Up (Multiple Customers)
```
You have 5 customers who haven't responded:

You type: #60111111111
You type: #60222222222
You type: #60333333333
You type: #60444444444
You type: #60555555555

✅ All 5 customers receive "Teruskan"
✅ AI handles all responses automatically
```

### Example 3: Testing Bot Responses
```
You want to test how bot handles a specific question:

You type: %60123456789 What's the price for 10 units?
✅ Bot sends to customer
✅ AI generates pricing response
✅ You can see if response is appropriate
```

### Example 4: Restart Stalled Conversation
```
Customer stopped replying at pricing stage:

You type: %60123456789 Hi! We have a special promotion today. Interested?
✅ Bot sends with new context
✅ Might re-engage the customer
```

---

## Important Notes

### ⚠️ Who Can Trigger?
- **ONLY you** (business WhatsApp owner)
- **ONLY from the connected device**
- Customers **cannot** use these commands

### 📋 Phone Number Format
Use the exact format from your database (`prospect_num` field):
- ✅ `60123456789`
- ✅ `60123456789@c.us`
- ✅ Whatever format is stored in `ai_whatsapp` table

### 🔄 What Happens Behind the Scenes?

**For `#` command:**
1. You send: `#60123456789`
2. Webhook receives command
3. Queues message: "Teruskan" for that phone
4. Debouncer processes message
5. AI generates response
6. Bot sends response to customer

**For `%` command:**
1. You send: `%60123456789 Custom message`
2. Webhook receives command
3. Queues your custom message for that phone
4. Debouncer processes message
5. AI generates response based on your message
6. Bot sends response to customer

---

## Comparison with Other Commands

| Command | Purpose | Message Sent | AI Response? |
|---------|---------|--------------|--------------|
| `#[phone]` | Trigger auto flow | "Teruskan" | ✅ Yes |
| `%[phone] [msg]` | Send custom message | Your message | ✅ Yes |
| `/[phone]` | Activate human mode | Nothing | ❌ No (human takes over) |
| `?[phone]` | Deactivate human mode | Nothing | ✅ Yes (AI resumes) |
| `cmd` | Human mode (in chat) | Nothing | ❌ No |
| `dmc` | AI mode (in chat) | Nothing | ✅ Yes |

---

## Troubleshooting

**Message not sent to customer?**
- ✅ Check phone number format matches database
- ✅ Verify you're sending from connected business WhatsApp
- ✅ Check webhook logs for errors
- ✅ Ensure customer exists in `ai_whatsapp` table

**AI not responding?**
- ✅ Check `human` field is not `1` (customer in human mode)
- ✅ Verify prompts are configured for that device
- ✅ Check Deno Deploy logs for processing errors

**Want to see what was sent?**
- ✅ Open customer's chat on your WhatsApp
- ✅ Check `conv_current` in database
- ✅ Review webhook logs

---

## Testing Checklist

- [ ] Test `#` command with your own number
- [ ] Test `%` command with custom message
- [ ] Verify bot sends message to customer
- [ ] Verify AI generates appropriate response
- [ ] Test with customer in human mode (should not work)
- [ ] Test with customer in AI mode (should work)
- [ ] Test from admin group chat (not in customer's chat)
- [ ] Verify messages appear in customer's chat history

---

## Quick Reference Card

```
┌──────────────────────────────────────────────────────────┐
│           MANUAL FLOW TRIGGER COMMANDS                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  AUTO TRIGGER (Default Message):                        │
│  ┌────────────────────────────────────┐                 │
│  │  #60123456789                      │                 │
│  └────────────────────────────────────┘                 │
│  Sends: "Teruskan" + AI response                        │
│                                                          │
│  CUSTOM TRIGGER (Your Message):                         │
│  ┌────────────────────────────────────┐                 │
│  │  %60123456789 Your message here    │                 │
│  └────────────────────────────────────┘                 │
│  Sends: Your message + AI response                      │
│                                                          │
└──────────────────────────────────────────────────────────┘

WHERE TO SEND:
• Any WhatsApp chat (admin group, saved messages, etc.)
• NOT in customer's chat (they won't see your command)
• Only from connected business WhatsApp device

RESULT:
• Customer receives message in their chat
• AI processes and generates response
• Conversation continues automatically
```

---

## Advanced Tips

### 💡 Tip 1: Batch Processing
You can send multiple manual triggers rapidly:
```
#60111111111
#60222222222
#60333333333
```
All will be queued and processed by the debouncer.

### 💡 Tip 2: Mix Auto and Custom
```
#60111111111  (Generic follow-up for Customer A)
%60222222222 Special offer just for you!  (Custom for Customer B)
#60333333333  (Generic follow-up for Customer C)
```

### 💡 Tip 3: Use in Admin Group
Create a dedicated admin WhatsApp group for sending all your commands. This keeps your personal chats clean and provides a log of all manual triggers.

### 💡 Tip 4: Testing New Prompts
Before going live with a new prompt, test it using `%` command:
```
%YOUR_OWN_NUMBER Hi, I'm interested in your product
```
See how the AI responds with your new prompt.

---

## Summary

**Manual flow** = Proactively trigger bot to message customers

**Two commands:**
- `#` = Auto (sends "Teruskan")
- `%` = Custom (sends your message)

**Both trigger AI response automatically**

**Use for:** Follow-ups, testing, re-engagement, proactive outreach
