# Dev Muse Automaton - Deno Backend

Complete TypeScript/Deno backend for WhatsApp chatbot automation platform.

## 📁 Project Structure

```
deno-backend/
├── main.ts                          # Entry point & routing
├── deno.json                        # Deno configuration
├── .env.example                     # Environment template
│
├── handlers/                        # HTTP request handlers
│   ├── auth.ts                     # Authentication (login, register, me)
│   ├── webhook.ts                  # WhatsApp webhooks (GET + POST)
│   ├── devices.ts                  # Device management
│   ├── flows.ts                    # Flow builder management
│   ├── conversations.ts            # Conversation history
│   ├── ai.ts                       # AI chat endpoints
│   ├── analytics.ts                # Analytics & reporting
│   ├── dashboard.ts                # Dashboard statistics
│   ├── orders.ts                   # Billing/orders (Billplz)
│   ├── packages.ts                 # Subscription packages
│   ├── stages.ts                   # Stage management
│   └── debounce.ts                 # Debounce processing
│
├── services/                        # Business logic
│   ├── debounce.ts                 # Message debouncing (4s delay)
│   ├── webhook-parser.ts           # Parse WhatsApp webhooks
│   ├── whatsapp-provider.ts        # WhatsApp API integrations
│   ├── ai.ts                       # AI completions (OpenAI/Google)
│   └── flow-execution.ts           # Flow execution engine
│
└── utils/                           # Utilities
    └── jwt.ts                      # JWT token generation/verification
```

## 🚀 Features

### ✅ Core Features
- **Authentication:** JWT-based auth with bcrypt password hashing
- **WhatsApp Integration:** Supports WAHA, Wablas, WhCenter providers
- **Webhook Handler:** GET (verification) + POST (messages) support
- **Message Debouncing:** 4-second delay to prevent duplicate responses
- **Flow Execution:** Node-based conversation flow engine
- **AI Integration:** OpenAI & Google Gemini via OpenRouter
- **Analytics:** Real-time statistics and reporting
- **Billing:** Billplz payment integration
- **Multi-tenant:** Support for multiple users and devices

### 🔧 Technical Features
- **TypeScript:** Full type safety
- **Deno Deploy:** Serverless deployment
- **Deno KV:** Built-in key-value storage for debouncing
- **Supabase:** PostgreSQL database via REST API
- **CORS:** Enabled for frontend integration
- **Error Handling:** Comprehensive error responses
- **Logging:** Detailed console logging

## 📋 API Endpoints

### Public Endpoints (No Auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/:deviceId/:webhookId` | Webhook verification |
| POST | `/:deviceId/:webhookId` | Webhook messages |
| GET | `/api/packages` | List packages |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | User registration |

### Protected Endpoints (Auth Required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Current user profile |
| GET/POST | `/api/devices` | Device management |
| GET/POST/PUT/DELETE | `/api/flows` | Flow management |
| GET | `/api/conversations` | Conversation history |
| POST | `/api/ai/chat` | AI chat completion |
| GET | `/api/analytics` | Analytics data |
| GET | `/api/dashboard/stats` | Dashboard stats |
| GET/POST | `/api/orders` | Billing/orders |
| GET/POST | `/api/stages` | Stage management |

## 🔑 Environment Variables

Required environment variables (set in Deno Deploy):

```bash
# Supabase
SUPABASE_URL=https://bjnjucwpwdzgsnqmpmff.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # CRITICAL!

# Security
JWT_SECRET=your-jwt-secret  # Generate with: crypto.randomBytes(64).toString('hex')

# Payment (Optional)
BILLPLZ_API_KEY=your-billplz-api-key
BILLPLZ_COLLECTION_ID=your-collection-id

# Configuration
DEBOUNCE_DELAY_MS=4000
SERVER_URL=https://pening-bot.deno.dev
```

## 🏃 Running Locally

### Prerequisites
- Deno 1.x installed

### Start Development Server
```bash
cd deno-backend
deno run --allow-net --allow-env --allow-read --unstable-kv main.ts
```

Or use the task:
```bash
deno task dev
```

Server will start on port 8000 (Deno default).

## 🚀 Deploy to Deno Deploy

### Option 1: Using deployctl CLI
```bash
deployctl deploy --project=pening-bot main.ts
```

### Option 2: GitHub Integration
1. Push code to GitHub
2. Link repository in Deno Deploy dashboard
3. Set entry point: `deno-backend/main.ts`
4. Auto-deploy on push

## 🧪 Testing

### Health Check
```bash
curl https://pening-bot.deno.dev/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "dev-muse-automaton-deno"
}
```

### Webhook Verification (GET)
```bash
curl "https://pening-bot.deno.dev/device123/webhook123?hub.challenge=test123"
```

Expected: Returns `test123`

### Webhook Message (POST)
```bash
curl -X POST https://pening-bot.deno.dev/device123/webhook123 \
  -H "Content-Type: application/json" \
  -d '{"phone":"6281234567890","message":"Hello","name":"Test"}'
```

Expected response:
```json
{
  "success": true,
  "message": "Message queued for processing",
  "processed": true,
  "debounced": true
}
```

### Login
```bash
curl -X POST https://pening-bot.deno.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

## 📊 Database Schema

The backend uses the following Supabase tables:

- `user` - User accounts
- `device_setting` - WhatsApp device configurations
- `chatbot_flows` - Conversation flows
- `ai_whatsapp` - AI conversation history
- `wasapbot` - Bot conversation history
- `orders` - Payment orders
- `packages` - Subscription packages
- `stagesetvalue` - Stage values

## 🔒 Security

- **JWT Tokens:** 7-day expiration
- **Password Hashing:** bcrypt with salt
- **Service Role Key:** Never exposed to frontend
- **CORS:** Configured for allowed origins
- **Input Validation:** All endpoints validate input
- **Authentication:** Required for sensitive operations

## 🛠️ Key Services

### Debouncing Service
- Queues messages using Deno KV
- 4-second delay before processing
- Timer resets if new message arrives
- Prevents duplicate AI responses

### WhatsApp Provider Service
- Supports 3 providers: WAHA, Wablas, WhCenter
- Unified interface for sending messages
- Session status checking
- Media support (images, files)

### Flow Execution Service
- Processes messages through flow nodes
- Supports: message, AI, condition nodes
- Tracks conversation state
- Fallback to simple AI if no flow

### AI Service
- OpenRouter integration (OpenAI, Google, etc.)
- Conversation context management
- Configurable per device
- Token usage tracking

## 📝 Code Style

- **TypeScript:** Strict mode enabled
- **Formatting:** 2 spaces, semicolons
- **Error Handling:** Try-catch in all handlers
- **Logging:** Console logging for debugging
- **Responses:** Consistent JSON format

## 🆘 Troubleshooting

### 401 Unauthorized
- Check `SUPABASE_SERVICE_ROLE_KEY` is set
- Verify JWT_SECRET matches frontend

### Webhook Not Working
- Verify device exists in database
- Check `device_id` and `webhook_id` match
- Test GET request for verification

### AI Not Responding
- Check device has `api_key` set
- Verify `api_key_option` is valid model
- Check OpenRouter API key

### Debouncing Not Working
- Deno KV is automatically enabled on Deno Deploy
- Check logs for "Message queued"
- Verify DEBOUNCE_DELAY_MS is set

## 📚 Additional Documentation

- [QUICK_START.md](../QUICK_START.md) - Fast deployment guide
- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) - Detailed deployment
- [MIGRATION_SUMMARY.md](../MIGRATION_SUMMARY.md) - Migration overview

## 🎯 Production Checklist

Before going to production:
- [ ] Set all environment variables
- [ ] Use production JWT secret (not default)
- [ ] Configure Supabase service role key
- [ ] Test all endpoints
- [ ] Update WhatsApp webhook URLs
- [ ] Test debouncing works
- [ ] Monitor Deno Deploy logs
- [ ] Set up error tracking

## 📞 Support

For issues or questions:
1. Check logs: https://dash.deno.com/projects/pening-bot/logs
2. Review documentation files
3. Test endpoints individually
4. Verify environment variables

---

**Built with ❤️ using Deno, TypeScript, and Supabase**
