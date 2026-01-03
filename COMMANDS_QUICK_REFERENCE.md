# WhatsApp Bot Commands - Quick Reference

## Command Types by Usage

### 📱 Type 1: Direct in Customer Chat (from Business WhatsApp)
**When to use:** You're already in the customer's chat on business WhatsApp

| Command | Action | Where to Type |
|---------|--------|---------------|
| `cmd` | Activate human mode | In customer's chat on business WA |
| `dmc` | Deactivate human mode (back to AI) | In customer's chat on business WA |

---

### 🤖 Type 2: Customer-Side Command (from YOUR test phone)
**When to use:** You're testing the bot from your personal phone

| Command | Action | Where to Type |
|---------|--------|---------------|
| `DELETE` | Delete your test conversation | In chat TO business WA (from your phone) |

---

### 🎮 Type 3: Remote Control (from YOUR personal phone TO business WA)
**When to use:** You want to control customers remotely from your phone

| Command | Action | Example |
|---------|--------|---------|
| `/[phone]` | Activate human mode for customer | `/60123456789` |
| `?[phone]` | Deactivate human mode for customer | `?60123456789` |
| `#[phone]` | Trigger auto flow (send "Teruskan") | `#60123456789` |
| `%[phone] [msg]` | Send custom message to customer | `%60123456789 Hi there!` |

**IMPORTANT:** These commands must be sent **TO your business WhatsApp number** from your personal phone!

---

## Visual Guide

```
┌─────────────────────────────────────────────────────────────┐
│                 WHO SENDS WHAT WHERE?                       │
└─────────────────────────────────────────────────────────────┘

SCENARIO 1: You're in customer chat on business WhatsApp
────────────────────────────────────────────────────────
Business WA → Customer Chat → Type: cmd or dmc


SCENARIO 2: You're testing from your personal phone
────────────────────────────────────────────────────────
Your Phone → TO Business WA → Type: DELETE


SCENARIO 3: You want to control remotely
────────────────────────────────────────────────────────
Your Phone → TO Business WA → Type: /phone, ?phone, #phone, %phone msg
```

---

## Examples by Scenario

### ✅ Scenario: Take Over Conversation Manually
```
1. Open business WhatsApp
2. Go to customer's chat
3. Type: cmd
4. Reply manually
5. When done, type: dmc
```

### ✅ Scenario: Control Customer from Your Phone
```
1. Open YOUR personal WhatsApp
2. Send TO business WhatsApp number: /60123456789
3. Customer is now in human mode
4. Open business WhatsApp to reply to customer
5. When done, from YOUR phone TO business WA: ?60123456789
```

### ✅ Scenario: Trigger Follow-up from Your Phone
```
1. Open YOUR personal WhatsApp
2. Send TO business WhatsApp number: #60123456789
3. Bot sends "Teruskan" to customer
4. AI generates response
```

### ✅ Scenario: Send Custom Message from Your Phone
```
1. Open YOUR personal WhatsApp
2. Send TO business WhatsApp number: %60123456789 Special offer today!
3. Bot sends "Special offer today!" to customer
4. AI generates response
```

### ✅ Scenario: Testing Bot - Reset Data
```
1. From YOUR personal phone chatting with business WA
2. You: Hello (testing)
3. Bot: Hi! Welcome...
4. You: DELETE (want to start fresh)
5. Bot: Sudah Delete Data Anda
6. ✅ Can now test from beginning again
```

---

## Common Mistakes ❌

### ❌ WRONG: Sending remote commands FROM business WhatsApp
```
❌ Opening business WhatsApp
❌ Typing: /60123456789
❌ This won't work!
```

### ✅ CORRECT: Sending remote commands TO business WhatsApp
```
✅ Opening YOUR personal WhatsApp
✅ Send TO business WA number: /60123456789
✅ This works!
```

---

### ❌ WRONG: Using `cmd` with phone number
```
❌ From personal phone TO business WA: cmd 60123456789
❌ This won't work!
```

### ✅ CORRECT: Use `/` for remote control
```
✅ From personal phone TO business WA: /60123456789
✅ This works!
```

---

## Decision Tree

```
Need to control a customer?
│
├─ Are you IN their chat on business WA?
│  ├─ Yes → Use: cmd or dmc
│  └─ No → Use: /phone or ?phone (from YOUR phone TO business WA)
│
├─ Want to send message to customer?
│  ├─ Generic "Teruskan" → Use: #phone (from YOUR phone TO business WA)
│  └─ Custom message → Use: %phone message (from YOUR phone TO business WA)
│
└─ Testing bot and want to reset?
   └─ Use: DELETE (from YOUR test phone TO business WA)
```

---

## Summary Table

| Use Case | Where You Are | What You Type | Where to Send |
|----------|---------------|---------------|---------------|
| Take over current chat | Business WA in customer chat | `cmd` | In that chat |
| Return to AI current chat | Business WA in customer chat | `dmc` | In that chat |
| Take over remotely | Your personal phone | `/60123456789` | TO business WA |
| Return to AI remotely | Your personal phone | `?60123456789` | TO business WA |
| Trigger auto follow-up | Your personal phone | `#60123456789` | TO business WA |
| Send custom message | Your personal phone | `%60123456789 Hi!` | TO business WA |
| Reset test data | Your personal phone (testing) | `DELETE` | TO business WA |

---

## Key Takeaways

1. **`cmd` and `dmc`** = Type directly in customer chat on business WhatsApp
2. **`/`, `?`, `#`, `%`** = Send from YOUR phone **TO** business WhatsApp
3. **`DELETE`** = Customer (or you testing) sends to business WhatsApp
4. **Remote commands** = Always include customer phone number
5. **Direct commands** = No phone number needed (already in chat)

---

## Testing Checklist

- [ ] Test `cmd` in customer chat ✅
- [ ] Test `dmc` in customer chat ✅
- [ ] Test `DELETE` from test phone ✅
- [ ] Test `/phone` from personal phone TO business WA ✅
- [ ] Test `?phone` from personal phone TO business WA ✅
- [ ] Test `#phone` from personal phone TO business WA ✅
- [ ] Test `%phone message` from personal phone TO business WA ✅

---

## Phone Setup

```
Device 1: Business WhatsApp (Connected to Bot)
└─ Receives commands
└─ Sends bot responses
└─ You use this to reply manually when in human mode

Device 2: Your Personal WhatsApp
└─ Send remote commands TO Device 1
└─ Use for testing as customer
└─ Use for controlling multiple customers
```
