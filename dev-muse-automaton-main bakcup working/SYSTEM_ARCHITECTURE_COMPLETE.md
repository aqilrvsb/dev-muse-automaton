# CHATBOT AUTOMATION SYSTEM - COMPLETE ARCHITECTURE DOCUMENTATION

**Purpose:** Complete documentation of the entire system before rebuilding from scratch with Supabase-only architecture.

**Date:** 2025-10-21
**Status:** Pre-rebuild documentation

---

## TABLE OF CONTENTS

1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Core Business Logic](#core-business-logic)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [External Integrations](#external-integrations)
8. [Data Flow Diagrams](#data-flow-diagrams)
9. [Deployment Configuration](#deployment-configuration)
10. [Rebuild Checklist](#rebuild-checklist)

---

## 1. SYSTEM OVERVIEW

### Technology Stack

**Backend:**
- **Language:** Go 1.23
- **Framework:** Fiber v2 (Express-like web framework)
- **Database:** Supabase (PostgreSQL) via REST API
- **Caching:** Redis (optional, with fallback)
- **Real-time:** WebSocket support via Fiber

**Frontend:**
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **UI Library:** shadcn/ui + Tailwind CSS
- **State Management:** React Query + Context API
- **Flow Builder:** React Flow library
- **Authentication:** Supabase Auth

**Deployment:**
- **Platform:** Railway
- **Docker:** Multi-stage build (Node + Go)
- **Health Checks:** /healthz endpoint
- **Static Assets:** Served from Go backend

### System Purpose

**Chatbot Automation Platform** for WhatsApp messaging with:
- Visual flow builder for creating conversation flows
- Multi-provider WhatsApp integration (Wablas, Whacenter, WAHA)
- AI-powered conversations using OpenAI/OpenRouter
- Multi-device support (3000+ concurrent devices)
- Lead tracking and analytics
- Message queue processing
- Webhook management
- Real-time updates via WebSocket

---

## 2. DATABASE SCHEMA

### Tables Overview

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | User accounts and authentication | id, email, password |
| `device_setting` | WhatsApp device configurations | device_id, provider_type, api_key |
| `chatbot_flows` | Visual flow definitions (nodes/edges) | id, device_id, flow_data (JSON) |
| `ai_whatsapp` | Conversation tracking and history | prospect_num, id_device, conversation_history |
| `wasapbot` | Legacy conversation tracking | id, deviceid, message |
| `ai_settings` | AI model configurations | id, provider, model, api_key |
| `conversation_log` | Message history logs | id, device_id, prospect_num, message |
| `user_sessions` | Active user sessions | id, user_id, token, expires_at |
| `orders` | Payment/billing records | id, user_id, amount, status |
| `execution_process` | Flow execution tracking | id, device_id, flow_id, status |
| `stage_set_value` | Stage-based configurations | id, device_id, stage_name, value |

### Critical Table: `device_setting`

```sql
CREATE TABLE device_setting (
    device_id TEXT PRIMARY KEY,
    user_id TEXT,
    provider_type TEXT, -- 'wablas', 'whacenter', 'waha'
    api_key TEXT,
    auth_header TEXT,
    webhook_url TEXT,
    base_url TEXT,
    status TEXT, -- 'active', 'inactive', 'disconnected'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Provider Types:**
- **wablas:** Wablas WhatsApp API
- **whacenter:** Whacenter WhatsApp API
- **waha:** WAHA (WhatsApp HTTP API) - advanced self-hosted option

### Critical Table: `chatbot_flows`

```sql
CREATE TABLE chatbot_flows (
    id TEXT PRIMARY KEY,
    device_id TEXT,
    flow_name TEXT,
    flow_data JSONB, -- React Flow nodes and edges
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**flow_data JSON structure:**
```json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "startNode",
      "position": {"x": 100, "y": 100},
      "data": {"label": "Start"}
    },
    {
      "id": "node-2",
      "type": "messageNode",
      "position": {"x": 300, "y": 100},
      "data": {
        "message": "Hello! How can I help you?",
        "delay": 1000
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2"
    }
  ]
}
```

### Critical Table: `ai_whatsapp`

```sql
CREATE TABLE ai_whatsapp (
    id_prospect SERIAL PRIMARY KEY,
    prospect_num TEXT, -- Phone number
    id_device TEXT,
    name TEXT,
    stage TEXT, -- Conversation stage
    niche TEXT,
    conversation_history JSONB, -- Array of messages
    ai_context TEXT,
    last_message_at TIMESTAMP,
    flow_node_id TEXT, -- Current flow node
    flow_tracking JSONB, -- Flow execution state
    session_locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**conversation_history JSON structure:**
```json
[
  {
    "role": "user",
    "content": "Hello",
    "timestamp": "2025-10-21T12:00:00Z"
  },
  {
    "role": "assistant",
    "content": "Hi! How can I help you?",
    "timestamp": "2025-10-21T12:00:05Z"
  }
]
```

---

## 3. BACKEND ARCHITECTURE

### Directory Structure

```
cmd/
  server/
    main.go                 # Application entry point

internal/
  config/
    config.go              # Environment configuration

  database/
    database.go            # PostgreSQL connection (legacy)
    supabase.go            # Supabase client wrapper
    supabase_sdk.go        # Supabase SDK (JavaScript-like API)
    supabase_rest.go       # REST API client
    rest_adapter.go        # SQL to REST adapter

  models/
    models.go              # Flow and chatbot models
    ai_settings.go         # AI configuration models
    device_settings.go     # Device configuration models
    wasapbot.go            # Conversation models
    order.go               # Billing models
    execution_process.go   # Flow execution models
    stage_set_value.go     # Stage configuration models

  repository/
    ai_whatsapp_repository.go            # SQL version
    ai_whatsapp_repository_supabase.go   # Supabase REST version
    device_settings_repository.go
    device_settings_repository_supabase.go
    wasapbot_repository.go
    wasapbot_repository_supabase.go
    order_repository.go
    order_repository_supabase.go
    execution_process_repository.go
    execution_process_repository_supabase.go
    stage_set_value_repository.go
    stage_set_value_repository_supabase.go

  services/
    flow_service.go              # Flow management and execution
    ai_service.go                # AI/OpenAI integration
    ai_whatsapp_service.go       # Conversation management
    unified_flow_service.go      # Combined flow + AI execution
    provider_service.go          # WhatsApp provider abstraction
    websocket_service.go         # Real-time updates
    media_service.go             # Media file handling
    media_detection_service.go   # Media type detection
    redis_service.go             # Redis caching
    rate_limiter.go              # API rate limiting
    queue_monitor.go             # Message queue management
    health_service.go            # System health checks
    device_settings_service.go   # Device management
    billplz_service.go           # Payment processing
    ai_response_processor.go     # AI response parsing
    condition_evaluation_fix.go  # Flow condition logic

  handlers/
    handlers.go                  # Flow API endpoints
    auth_handlers.go             # Authentication endpoints
    ai_whatsapp_handlers.go      # Conversation API endpoints
    device_settings_handlers.go  # Device management endpoints
    wasapbot_handlers.go         # Legacy conversation endpoints
    health_handlers.go           # Health check endpoints
    profile_handlers.go          # User profile endpoints
    billing_handlers.go          # Payment endpoints
    app_data_handlers.go         # App data endpoints
    waha_support.go              # WAHA-specific handlers

  whatsapp/
    whatsapp_service.go          # WhatsApp service facade
    wasapbot_flow.go             # Flow execution engine

  utils/
    sql_helpers.go               # SQL utility functions
    transaction.go               # Database transactions
    url_validator.go             # URL validation
```

### Main Application Flow (main.go)

```go
func main() {
    // 1. Load environment variables
    godotenv.Load()
    cfg := config.Load()

    // 2. Create Fiber app with IMMEDIATE health endpoint (Railway requirement)
    app := fiber.New()
    app.Get("/healthz", healthHandler)

    // 3. Start server in background IMMEDIATELY
    go app.Listen("0.0.0.0:8080")

    // 4. Initialize Supabase SDK in background
    supabaseSDK := database.InitSupabaseSDK(cfg)

    // 5. Initialize repositories (Supabase REST API)
    aiWhatsappRepo := repository.NewAIWhatsappRepositorySupabase(supabaseSDK)
    deviceSettingsRepo := repository.NewDeviceSettingsRepositorySupabase(supabaseSDK)
    wasapBotRepo := repository.NewWasapBotRepositorySupabase(supabaseSDK)
    // ... etc

    // 6. Initialize services
    flowService := services.NewFlowService(supabaseSDK)
    aiService := services.NewAIService(deviceSettingsRepo)
    providerService := services.NewProviderService()
    websocketService := services.NewWebSocketService()
    // ... etc

    // 7. Initialize handlers
    flowHandlers := handlers.NewFlowHandlers(flowService, websocketService)
    aiWhatsappHandlers := handlers.NewAIWhatsappHandlers(aiWhatsappService)
    // ... etc

    // 8. Setup routes
    setupRoutes(app, flowHandlers, aiWhatsappHandlers, ...)

    // 9. Wait for shutdown signal
    waitForShutdown()
}
```

**Key Design Decisions:**
- Server starts IMMEDIATELY (Railway health check requirement)
- Supabase initialization in background (no blocking)
- All repositories use Supabase REST API (no PostgreSQL direct connection)
- Fallback to nil services if initialization fails (graceful degradation)

### Service Layer Architecture

**FlowService** - Manages chatbot flows
```go
type FlowService struct {
    supabase *database.SupabaseSDK
}

// Key methods:
- GetFlow(deviceID, flowID) - Fetch flow by ID
- SaveFlow(flow) - Save/update flow
- ListFlows(deviceID) - List all flows for device
- DeleteFlow(flowID) - Delete flow
- ActivateFlow(flowID) - Set flow as active
```

**AIService** - AI/OpenAI integration
```go
type AIService struct {
    deviceSettingsRepo repository.DeviceSettingsRepository
}

// Key methods:
- GenerateResponse(prompt, history, settings) - Get AI response
- StreamResponse(prompt, history) - Stream AI response (SSE)
- ParseAIResponse(response) - Extract structured data from AI
```

**UnifiedFlowService** - Combines flow execution + AI
```go
type UnifiedFlowService struct {
    flowService *FlowService
    aiService *AIService
    aiWhatsappRepo repository.AIWhatsappRepository
    providerService *ProviderService
}

// Key methods:
- ProcessMessage(deviceID, prospectNum, message) - Main entry point
- ExecuteFlow(deviceID, prospectNum, flowData) - Execute flow nodes
- HandleAINode(node, context) - Process AI prompt nodes
- HandleConditionNode(node, context) - Evaluate conditions
```

**ProviderService** - WhatsApp provider abstraction
```go
type ProviderService struct {
    // Abstracts 3 different WhatsApp APIs
}

// Key methods:
- SendMessage(deviceID, to, message) - Send text message
- SendMedia(deviceID, to, mediaURL, caption) - Send media
- GetProviderType(deviceID) - Detect provider (wablas/whacenter/waha)
```

### Repository Pattern

All repositories have DUAL implementations:
1. SQL-based (legacy, using database/sql)
2. Supabase REST-based (new, using Supabase SDK)

**Example: AIWhatsappRepository**

```go
type AIWhatsappRepository interface {
    GetByProspectAndDevice(ctx, prospectNum, deviceID) (*models.AIWhatsapp, error)
    Create(ctx, ai *models.AIWhatsapp) error
    Update(ctx, ai *models.AIWhatsapp) error
    SaveConversationHistory(ctx, prospectNum, deviceID, history) error
    GetAnalyticsData(ctx, deviceID, dateRange) (*Analytics, error)
    TryAcquireSession(ctx, prospectNum, deviceID, duration) (bool, error)
    ReleaseSession(ctx, prospectNum, deviceID) error
    // ... 20+ more methods
}

// Supabase implementation uses REST API:
type AIWhatsappRepositorySupabase struct {
    supabase *database.SupabaseSDK
}

func (r *AIWhatsappRepositorySupabase) GetByProspectAndDevice(ctx context.Context, prospectNum, deviceID string) (*models.AIWhatsapp, error) {
    var results []models.AIWhatsapp
    err := r.supabase.From("ai_whatsapp").
        Select("*").
        Eq("prospect_num", prospectNum).
        Eq("id_device", deviceID).
        Execute(ctx, &results)

    if len(results) == 0 {
        return nil, sql.ErrNoRows
    }
    return &results[0], err
}
```

---

## 4. FRONTEND ARCHITECTURE

### Directory Structure

```
src/
  components/
    ChatbotBuilder.tsx       # Main flow builder component
    FlowManager.tsx          # Flow CRUD UI
    FlowSelector.tsx         # Flow selection dropdown
    FlowPreview.tsx          # Flow visualization

    nodes/
      StartNode.tsx          # Start node (entry point)
      MessageNode.tsx        # Send text message
      UserReplyNode.tsx      # Wait for user input
      PromptNode.tsx         # AI prompt node
      ConditionNode.tsx      # Conditional branching
      StageNode.tsx          # Set conversation stage
      ImageNode.tsx          # Send image
      VideoNode.tsx          # Send video
      AudioNode.tsx          # Send audio
      DelayNode.tsx          # Add delay

    LeadDashboard.tsx        # Analytics dashboard
    LeadTable.tsx            # Lead data table
    LeadChart.tsx            # Analytics charts
    AIWhatsappDataTable.tsx  # Conversation data table
    DeviceStatusPopup.tsx    # Device connection status
    DeviceRequiredWrapper.tsx # Device validation wrapper

    ui/                      # shadcn/ui components (50+ files)
      button.tsx
      dialog.tsx
      table.tsx
      form.tsx
      ... (standard UI components)

  pages/
    Login.tsx                # Login page
    Register.tsx             # Registration page
    Dashboard.tsx            # Main dashboard (flow list)
    FlowBuilder.tsx          # Flow builder page
    FlowManager.tsx          # Flow management page
    DeviceSettings.tsx       # Device configuration page
    WhatsAppBot.tsx          # Bot management page
    Analytics.tsx            # Analytics page (old)
    AnalyticsNew.tsx         # Analytics page (new)
    LeadAnalytics.tsx        # Lead analytics
    Profile.tsx              # User profile
    Billings.tsx             # Billing page
    SetStage.tsx             # Stage management

  contexts/
    AuthContext.tsx          # Authentication state
    DeviceContext.tsx        # Selected device state

  hooks/
    useDeviceSettings.ts     # Device settings hook

  integrations/
    supabase/
      client.ts              # Supabase client setup
      types.ts               # Database type definitions

  lib/
    supabaseFlowStorage.ts   # Flow CRUD operations

  main.tsx                   # App entry point
  App.tsx                    # Main app component (routing)
```

### React Router Structure

```typescript
<Routes>
  {/* Public routes */}
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />

  {/* Protected routes */}
  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
  <Route path="/flow-builder" element={<ProtectedRoute><FlowBuilder /></ProtectedRoute>} />
  <Route path="/flow-manager" element={<ProtectedRoute><FlowManager /></ProtectedRoute>} />
  <Route path="/device-settings" element={<ProtectedRoute><DeviceSettings /></ProtectedRoute>} />
  <Route path="/whatsapp-bot" element={<ProtectedRoute><WhatsAppBot /></ProtectedRoute>} />
  <Route path="/analytics" element={<ProtectedRoute><AnalyticsNew /></ProtectedRoute>} />
  <Route path="/lead-analytics" element={<ProtectedRoute><LeadAnalytics /></ProtectedRoute>} />
  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
  <Route path="/billings" element={<ProtectedRoute><Billings /></ProtectedRoute>} />
  <Route path="/set-stage" element={<ProtectedRoute><SetStage /></ProtectedRoute>} />
</Routes>
```

### Flow Builder Component

**ChatbotBuilder.tsx** - Main flow builder using React Flow

```typescript
const ChatbotBuilder = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const reactFlowInstance = useReactFlow();

  // Node types
  const nodeTypes = {
    startNode: StartNode,
    messageNode: MessageNode,
    userReplyNode: UserReplyNode,
    promptNode: PromptNode,
    conditionNode: ConditionNode,
    stageNode: StageNode,
    imageNode: ImageNode,
    videoNode: VideoNode,
    audioNode: AudioNode,
    delayNode: DelayNode,
  };

  // Save flow to Supabase
  const saveFlow = async () => {
    const flowData = {
      nodes: nodes,
      edges: edges,
    };

    await supabase.from('chatbot_flows').upsert({
      id: flowId,
      device_id: selectedDevice,
      flow_data: flowData,
    });
  };

  // Add node to canvas
  const addNode = (type: string) => {
    const newNode = {
      id: `node-${Date.now()}`,
      type: type,
      position: { x: 100, y: 100 },
      data: { label: type },
    };
    setNodes([...nodes, newNode]);
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
};
```

### Authentication Flow

```typescript
// AuthContext.tsx
const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async (email, password) => {},
  logout: async () => {},
  isAuthenticated: false,
});

// Login.tsx
const handleLogin = async (email: string, password: string) => {
  // Option 1: Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Option 2: Custom backend API
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (response.ok) {
    const { token } = await response.json();
    localStorage.setItem('auth_token', token);
    navigate('/dashboard');
  }
};
```

### Device Selection Flow

```typescript
// DeviceContext.tsx
const DeviceContext = createContext<DeviceContextType>({
  selectedDevice: null,
  setSelectedDevice: (deviceId: string) => {},
  devices: [],
  refreshDevices: async () => {},
});

// DeviceRequiredWrapper.tsx
const DeviceRequiredWrapper = ({ children }) => {
  const { selectedDevice } = useDeviceContext();

  if (!selectedDevice) {
    return <DeviceRequiredPopup />;
  }

  return children;
};
```

---

## 5. CORE BUSINESS LOGIC

### Message Processing Pipeline

**Entry Point:** Webhook from WhatsApp provider

```
1. Webhook received (/api/webhook/:provider/:deviceID)
   ↓
2. Extract message data (prospectNum, message, mediaURL, etc.)
   ↓
3. Check if device exists and is active
   ↓
4. Try to acquire session lock (prevent duplicate processing)
   ↓
5. Load or create AIWhatsapp record
   ↓
6. Load active flow for device
   ↓
7. Execute flow (UnifiedFlowService.ProcessMessage)
   ↓
8. Determine next action:
   - Execute flow nodes sequentially
   - OR trigger AI conversation
   - OR wait for user reply
   ↓
9. Send response via WhatsApp provider
   ↓
10. Update conversation history
   ↓
11. Release session lock
   ↓
12. Emit WebSocket event (real-time update)
```

### Flow Execution Engine

**File:** `internal/whatsapp/wasapbot_flow.go`

```go
func ExecuteFlow(deviceID, prospectNum string, flowData *models.FlowData) error {
    // 1. Find START node
    startNode := findNodeByType(flowData.Nodes, "startNode")

    // 2. Execute nodes sequentially following edges
    currentNodeID := startNode.ID

    for currentNodeID != "" {
        node := findNodeByID(flowData.Nodes, currentNodeID)

        // Execute node based on type
        switch node.Type {
        case "messageNode":
            executeMessageNode(node, deviceID, prospectNum)

        case "userReplyNode":
            // Wait for user input - store current node ID
            saveFlowState(prospectNum, deviceID, currentNodeID)
            return nil // Exit flow, wait for next message

        case "promptNode":
            executePromptNode(node, deviceID, prospectNum)

        case "conditionNode":
            // Evaluate condition, choose edge
            nextNodeID = evaluateCondition(node, context)
            currentNodeID = nextNodeID
            continue

        case "stageNode":
            updateStage(prospectNum, deviceID, node.Data.Stage)

        case "delayNode":
            time.Sleep(time.Duration(node.Data.Delay) * time.Millisecond)
        }

        // Find next node via edges
        nextEdge := findEdgeFromSource(flowData.Edges, currentNodeID)
        if nextEdge == nil {
            break // End of flow
        }
        currentNodeID = nextEdge.Target
    }

    return nil
}
```

### Node Types Explained

1. **startNode**
   - Entry point of flow
   - No configuration
   - Flow execution begins here

2. **messageNode**
   - Sends text message to user
   - Configuration:
     - `message`: Text to send
     - `delay`: Delay before sending (ms)
   - Example: "Hello! Welcome to our service."

3. **userReplyNode**
   - Pauses flow, waits for user input
   - Stores current flow state
   - Next message resumes flow from this point
   - Configuration:
     - `variable`: Store user input in variable

4. **promptNode**
   - Sends message to AI (OpenAI/OpenRouter)
   - AI generates response based on prompt + conversation history
   - Configuration:
     - `prompt`: System prompt for AI
     - `model`: AI model (gpt-4, claude-3, etc.)
     - `temperature`: Creativity level (0-1)

5. **conditionNode**
   - Evaluates condition, branches to different paths
   - Configuration:
     - `condition`: Expression to evaluate
     - `trueTarget`: Node ID if true
     - `falseTarget`: Node ID if false
   - Example: `{{stage}} == "qualified"` → route to sales flow

6. **stageNode**
   - Updates conversation stage
   - Used for tracking lead progress
   - Configuration:
     - `stage`: New stage value
   - Example stages: "new", "qualified", "interested", "closed"

7. **imageNode**
   - Sends image to user
   - Configuration:
     - `imageUrl`: URL of image
     - `caption`: Optional caption

8. **videoNode**
   - Sends video to user
   - Configuration:
     - `videoUrl`: URL of video
     - `caption`: Optional caption

9. **audioNode**
   - Sends audio to user
   - Configuration:
     - `audioUrl`: URL of audio
     - `caption`: Optional caption

10. **delayNode**
    - Adds delay between messages
    - Configuration:
      - `delay`: Delay in milliseconds

### Condition Evaluation

**File:** `internal/services/condition_evaluation_fix.go`

```go
func EvaluateCondition(condition string, context map[string]interface{}) bool {
    // Replace variables with values
    // {{stage}} → "qualified"
    // {{message}} → "I'm interested"

    replaced := replaceVariables(condition, context)

    // Evaluate expression
    // "qualified" == "qualified" → true
    // "I'm interested" contains "interested" → true

    return evaluateExpression(replaced)
}

// Supported operators:
// ==, !=, >, <, >=, <=
// contains, not contains
// starts with, ends with
// and, or, not
```

### AI Conversation Flow

**File:** `internal/services/ai_service.go`

```go
func GenerateResponse(prompt string, history []Message, settings *AISettings) (string, error) {
    // 1. Build messages array
    messages := []Message{
        {Role: "system", Content: prompt},
    }
    messages = append(messages, history...)

    // 2. Call OpenAI/OpenRouter API
    req := &OpenAIRequest{
        Model: settings.Model,
        Messages: messages,
        Temperature: settings.Temperature,
        MaxTokens: settings.MaxTokens,
    }

    resp, err := http.Post("https://openrouter.ai/api/v1/chat/completions", req)

    // 3. Parse response
    var aiResp OpenAIResponse
    json.Unmarshal(resp.Body, &aiResp)

    return aiResp.Choices[0].Message.Content, nil
}
```

**Conversation History Management:**

```go
// Save conversation to database
func SaveConversationHistory(prospectNum, deviceID string, userMessage, aiResponse string) {
    // Load existing history
    ai, _ := aiWhatsappRepo.GetByProspectAndDevice(prospectNum, deviceID)

    history := ai.ConversationHistory

    // Append new messages
    history = append(history, Message{
        Role: "user",
        Content: userMessage,
        Timestamp: time.Now(),
    })

    history = append(history, Message{
        Role: "assistant",
        Content: aiResponse,
        Timestamp: time.Now(),
    })

    // Keep only last 20 messages (prevent token limit)
    if len(history) > 20 {
        history = history[len(history)-20:]
    }

    // Save to database
    aiWhatsappRepo.SaveConversationHistory(prospectNum, deviceID, history)
}
```

### Session Locking (Prevent Duplicate Processing)

```go
func TryAcquireSession(prospectNum, deviceID string, duration time.Duration) (bool, error) {
    now := time.Now()
    lockUntil := now.Add(duration)

    // Try to acquire lock (atomic operation)
    result := supabase.From("ai_whatsapp").
        Update(map[string]interface{}{
            "session_locked_until": lockUntil,
        }).
        Eq("prospect_num", prospectNum).
        Eq("id_device", deviceID).
        // Only update if not currently locked
        Or("session_locked_until is null").
        Or("session_locked_until < ?", now).
        Execute()

    // Check if update succeeded (lock acquired)
    return result.AffectedRows > 0, nil
}

func ReleaseSession(prospectNum, deviceID string) error {
    return supabase.From("ai_whatsapp").
        Update(map[string]interface{}{
            "session_locked_until": nil,
        }).
        Eq("prospect_num", prospectNum).
        Eq("id_device", deviceID).
        Execute()
}
```

---

## 6. API ENDPOINTS REFERENCE

### Authentication Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/logout` | Logout current user |
| GET | `/api/auth/me` | Get current user info |
| POST | `/api/auth/refresh` | Refresh auth token |

### Flow Management Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/flows` | List all flows for user |
| GET | `/api/flows/:id` | Get flow by ID |
| POST | `/api/flows` | Create new flow |
| PUT | `/api/flows/:id` | Update flow |
| DELETE | `/api/flows/:id` | Delete flow |
| POST | `/api/flows/:id/activate` | Activate flow |
| POST | `/api/flows/:id/deactivate` | Deactivate flow |
| GET | `/api/flows/device/:deviceId` | Get flows by device |

### Device Management Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/devices` | List all devices |
| GET | `/api/devices/:id` | Get device by ID |
| POST | `/api/devices` | Create new device |
| PUT | `/api/devices/:id` | Update device |
| DELETE | `/api/devices/:id` | Delete device |
| POST | `/api/devices/:id/test` | Test device connection |
| GET | `/api/devices/:id/status` | Get device status |
| POST | `/api/devices/:id/disconnect` | Disconnect device |

### Webhook Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhook/wablas/:deviceId` | Wablas webhook |
| POST | `/api/webhook/whacenter/:deviceId` | Whacenter webhook |
| POST | `/api/webhook/waha/:deviceId` | WAHA webhook |

### Conversation Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ai-whatsapp` | List conversations |
| GET | `/api/ai-whatsapp/:prospectNum/:deviceId` | Get conversation |
| POST | `/api/ai-whatsapp` | Create conversation |
| PUT | `/api/ai-whatsapp/:prospectNum/:deviceId` | Update conversation |
| DELETE | `/api/ai-whatsapp/:prospectNum/:deviceId` | Delete conversation |
| GET | `/api/ai-whatsapp/analytics` | Get analytics data |
| POST | `/api/ai-whatsapp/broadcast` | Send broadcast message |

### Analytics Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/dashboard` | Dashboard stats |
| GET | `/api/analytics/conversations` | Conversation stats |
| GET | `/api/analytics/leads` | Lead stats |
| GET | `/api/analytics/stages` | Stage breakdown |
| GET | `/api/analytics/niches` | Niche breakdown |
| GET | `/api/analytics/daily` | Daily stats |

### Health Check Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Railway health check |
| GET | `/health/basic` | Basic health check |
| GET | `/health/full` | Full system health |
| GET | `/health/db` | Database health |
| GET | `/health/redis` | Redis health |

### WebSocket Endpoints

| Path | Description |
|------|-------------|
| `/ws` | WebSocket connection for real-time updates |

---

## 7. EXTERNAL INTEGRATIONS

### WhatsApp Provider: Wablas

**Base URL:** `https://console.wablas.com`

**Authentication:** API Key in header

**Endpoints Used:**

1. **Send Text Message**
```http
POST /api/send-message
Headers:
  Authorization: Bearer {API_KEY}
Body:
  {
    "phone": "628123456789",
    "message": "Hello World",
    "isGroup": false
  }
```

2. **Send Image**
```http
POST /api/send-image
Headers:
  Authorization: Bearer {API_KEY}
Body:
  {
    "phone": "628123456789",
    "image": "https://example.com/image.jpg",
    "caption": "Check this out"
  }
```

3. **Send Video**
```http
POST /api/send-video
Headers:
  Authorization: Bearer {API_KEY}
Body:
  {
    "phone": "628123456789",
    "video": "https://example.com/video.mp4",
    "caption": "Watch this"
  }
```

**Webhook Format:**
```json
{
  "phone": "628123456789",
  "message": "User message text",
  "name": "John Doe",
  "timestamp": 1634567890,
  "messageId": "ABC123"
}
```

### WhatsApp Provider: Whacenter

**Base URL:** `https://api.whacenter.com`

**Authentication:** Auth Header (custom token)

**Endpoints Used:**

1. **Send Message**
```http
POST /send
Headers:
  Authorization: {AUTH_HEADER}
Body:
  {
    "to": "628123456789",
    "type": "text",
    "text": {
      "body": "Hello World"
    }
  }
```

2. **Send Media**
```http
POST /send
Headers:
  Authorization: {AUTH_HEADER}
Body:
  {
    "to": "628123456789",
    "type": "image",
    "image": {
      "link": "https://example.com/image.jpg",
      "caption": "Check this out"
    }
  }
```

**Webhook Format:**
```json
{
  "from": "628123456789",
  "type": "text",
  "text": {
    "body": "User message text"
  },
  "timestamp": "1634567890",
  "id": "ABC123"
}
```

### WhatsApp Provider: WAHA (WhatsApp HTTP API)

**Base URL:** Self-hosted (e.g., `http://localhost:3000`)

**Authentication:** API Key in header

**Endpoints Used:**

1. **Send Text**
```http
POST /api/sendText
Headers:
  X-API-KEY: {API_KEY}
Body:
  {
    "session": "default",
    "chatId": "628123456789@c.us",
    "text": "Hello World"
  }
```

2. **Send Image**
```http
POST /api/sendImage
Headers:
  X-API-KEY: {API_KEY}
Body:
  {
    "session": "default",
    "chatId": "628123456789@c.us",
    "file": {
      "url": "https://example.com/image.jpg"
    },
    "caption": "Check this out"
  }
```

**Webhook Format:**
```json
{
  "event": "message",
  "session": "default",
  "payload": {
    "from": "628123456789@c.us",
    "body": "User message text",
    "hasMedia": false,
    "timestamp": 1634567890
  }
}
```

### OpenAI/OpenRouter Integration

**OpenRouter URL:** `https://openrouter.ai/api/v1/chat/completions`

**Authentication:** Bearer token

**Request Format:**
```json
{
  "model": "openai/gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful sales assistant."
    },
    {
      "role": "user",
      "content": "I'm interested in your product"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Response Format:**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1634567890,
  "model": "openai/gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Great! I'd love to tell you more about our product..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 100,
    "total_tokens": 150
  }
}
```

**Supported Models:**
- `openai/gpt-4`
- `openai/gpt-3.5-turbo`
- `anthropic/claude-3-opus`
- `anthropic/claude-3-sonnet`
- `google/gemini-pro`

### Supabase Integration

**URL:** `https://bjnjucwpwdzgsnqmpmff.supabase.co`

**Authentication:** Anon Key + JWT

**REST API Pattern:**
```http
GET /rest/v1/chatbot_flows?device_id=eq.DEVICE123
Headers:
  apikey: {ANON_KEY}
  Authorization: Bearer {JWT_TOKEN}
  Content-Type: application/json
```

**SDK Usage in Frontend:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bjnjucwpwdzgsnqmpmff.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
);

// Query data
const { data, error } = await supabase
  .from('chatbot_flows')
  .select('*')
  .eq('device_id', 'DEVICE123');

// Insert data
const { data, error } = await supabase
  .from('chatbot_flows')
  .insert({
    device_id: 'DEVICE123',
    flow_name: 'Welcome Flow',
    flow_data: { nodes: [], edges: [] }
  });
```

---

## 8. DATA FLOW DIAGRAMS

### Message Processing Flow

```
WhatsApp User
    |
    | (1) Sends message via WhatsApp
    v
WhatsApp Provider (Wablas/Whacenter/WAHA)
    |
    | (2) POST webhook to our server
    v
Backend /api/webhook/:provider/:deviceId
    |
    | (3) Parse webhook payload
    v
UnifiedFlowService.ProcessMessage()
    |
    | (4) Try acquire session lock
    v
Check Session Lock
    |
    | (5) If locked, skip (duplicate prevention)
    | (6) If unlocked, acquire lock
    v
Load AIWhatsapp Record
    |
    | (7) Get or create conversation record
    v
Load Active Flow
    |
    | (8) Get flow from chatbot_flows table
    v
Execute Flow Nodes
    |
    |---> (9a) messageNode → Send message
    |---> (9b) userReplyNode → Wait for input (save state)
    |---> (9c) promptNode → Call AI API
    |---> (9d) conditionNode → Evaluate condition
    |---> (9e) stageNode → Update stage
    |---> (9f) mediaNode → Send media
    v
Send Response via Provider
    |
    | (10) POST to Wablas/Whacenter/WAHA API
    v
Save Conversation History
    |
    | (11) Update ai_whatsapp.conversation_history
    v
Release Session Lock
    |
    | (12) Clear session_locked_until
    v
Emit WebSocket Event
    |
    | (13) Notify connected clients of update
    v
Frontend Updates Real-time
```

### Flow Builder Save Flow

```
User in ChatbotBuilder.tsx
    |
    | (1) Drags nodes, connects edges
    v
React Flow State (nodes, edges)
    |
    | (2) User clicks "Save"
    v
ChatbotBuilder.saveFlow()
    |
    | (3) Serialize nodes + edges to JSON
    v
supabaseFlowStorage.saveFlow()
    |
    | (4) Supabase client.from('chatbot_flows').upsert()
    v
Supabase Database
    |
    | (5) Store flow_data as JSONB
    v
Success Response
    |
    | (6) Show toast notification
    v
User Sees "Flow Saved Successfully"
```

### Authentication Flow

```
User on Login Page
    |
    | (1) Enter email + password
    v
Login.tsx handleLogin()
    |
    | (2) POST /api/auth/login
    v
Backend auth_handlers.go
    |
    | (3) Check credentials
    | (3a) Option 1: Supabase Auth
    | (3b) Option 2: Custom DB lookup
    v
Validate Password
    |
    | (4) bcrypt.CompareHashAndPassword()
    v
Generate JWT Token
    |
    | (5) jwt.Sign({ user_id, email, exp })
    v
Return Token to Frontend
    |
    | (6) { "token": "eyJ...", "user": {...} }
    v
Frontend Stores Token
    |
    | (7) localStorage.setItem('auth_token', token)
    v
AuthContext Updates
    |
    | (8) setUser(user), setIsAuthenticated(true)
    v
Redirect to /dashboard
```

---

## 9. DEPLOYMENT CONFIGURATION

### Railway Configuration (railway.toml)

```toml
[build]
  builder = "DOCKERFILE"
  watchPatterns = [
    "cmd/**/*.go",
    "internal/**/*.go",
    "src/**/*.tsx",
    "src/**/*.ts",
    "Dockerfile"
  ]

[deploy]
  startCommand = "/app/server"
  restartPolicyType = "ON_FAILURE"
  restartPolicyMaxRetries = 3
  healthcheckPath = "/healthz"
  healthcheckTimeout = 10
  skipCache = true
```

### Dockerfile (Multi-stage Build)

```dockerfile
# Stage 1: Build Frontend (Node.js)
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src/ ./src/
COPY public/ ./public/
COPY index.html vite.config.ts tsconfig.json ./
COPY tailwind.config.ts postcss.config.js ./

# Build frontend with environment variables
ARG VITE_SUPABASE_URL=https://bjnjucwpwdzgsnqmpmff.supabase.co
ARG VITE_SUPABASE_ANON_KEY=eyJ...
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# Stage 2: Build Backend (Go)
FROM golang:1.23-alpine AS backend-builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /app/bin/server ./cmd/server

# Stage 3: Final Runtime Image
FROM alpine:latest
RUN apk add --no-cache ca-certificates tzdata wget bash
WORKDIR /app
COPY --from=backend-builder /app/bin/server /app/server
COPY --from=frontend-builder /app/dist /app/dist
EXPOSE 8080
ENV PORT=8080
ENV APP_ENV=production
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/healthz || exit 1
CMD ["/app/server"]
```

### Environment Variables

**Required:**
- `PORT` - Server port (default: 8080)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (admin)

**Optional:**
- `REDIS_URL` - Redis connection URL (for caching)
- `REDIS_PASSWORD` - Redis password
- `APP_ENV` - Environment (development/production)

**Frontend (Build-time):**
- `VITE_SUPABASE_URL` - Supabase URL for frontend
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key for frontend

### Static File Serving (main.go)

```go
// Serve static assets
app.Static("/assets", "./dist/assets", fiber.Static{
    Compress: true,
    ByteRange: true,
    CacheDuration: 0,
    MaxAge: 0,
})

// Serve index.html for all non-API routes (SPA)
app.Get("/*", func(c *fiber.Ctx) error {
    path := c.Path()

    // Don't serve index.html for static file extensions
    if strings.Contains(path, ".") {
        staticExtensions := []string{".js", ".css", ".png", ".jpg", ".ico", ".map"}
        for _, ext := range staticExtensions {
            if strings.HasSuffix(path, ext) {
                return fiber.NewError(404, "Asset not found")
            }
        }
    }

    // Serve React SPA
    c.Set("Content-Type", "text/html; charset=utf-8")
    return c.SendFile("./dist/index.html")
})
```

---

## 10. REBUILD CHECKLIST

### Phase 1: Project Setup

- [ ] Create new directory: `chatbot-automation-v2`
- [ ] Initialize Go module: `go mod init chatbot-automation-v2`
- [ ] Initialize Node.js project: `npm init -y`
- [ ] Install Vite + React: `npm create vite@latest`
- [ ] Install Go dependencies:
  - `github.com/gofiber/fiber/v2`
  - `github.com/gofiber/contrib/websocket`
  - Supabase Go client (research)
- [ ] Install Node dependencies:
  - `@supabase/supabase-js`
  - `react-query`
  - `react-router-dom`
  - `reactflow`
  - `tailwindcss`
  - shadcn/ui components

### Phase 2: Database Schema (Supabase)

- [ ] Create Supabase project
- [ ] Create `users` table
- [ ] Create `device_setting` table
- [ ] Create `chatbot_flows` table
- [ ] Create `ai_whatsapp` table
- [ ] Create `wasapbot` table (optional, for compatibility)
- [ ] Create `ai_settings` table
- [ ] Create `conversation_log` table
- [ ] Create `orders` table
- [ ] Create `execution_process` table
- [ ] Create `stage_set_value` table
- [ ] Set up Row Level Security (RLS) policies
- [ ] Create database indexes for performance
- [ ] Set up Supabase Auth (email/password)

### Phase 3: Backend Core (Go)

- [ ] Create directory structure:
  - `cmd/server/main.go`
  - `internal/config/`
  - `internal/models/`
  - `internal/database/`
  - `internal/repository/`
  - `internal/services/`
  - `internal/handlers/`
  - `internal/whatsapp/`
  - `internal/utils/`

- [ ] Implement Supabase SDK wrapper (pure REST API)
- [ ] Implement models (structs matching database tables)
- [ ] Implement repositories (Supabase REST only)
- [ ] Implement core services:
  - FlowService
  - AIService
  - ProviderService
  - WebSocketService
  - QueueService
- [ ] Implement HTTP handlers:
  - Auth handlers
  - Flow handlers
  - Device handlers
  - Webhook handlers
  - Analytics handlers
- [ ] Implement flow execution engine
- [ ] Implement WhatsApp provider integrations

### Phase 4: Frontend Core (React)

- [ ] Set up React Router
- [ ] Create AuthContext
- [ ] Create DeviceContext
- [ ] Implement pages:
  - Login
  - Register
  - Dashboard
  - FlowBuilder
  - DeviceSettings
  - WhatsAppBot
  - Analytics
  - Profile
- [ ] Implement ChatbotBuilder component (React Flow)
- [ ] Implement all node types (10 types)
- [ ] Implement Supabase client setup
- [ ] Implement API hooks (React Query)
- [ ] Set up Tailwind CSS
- [ ] Install and configure shadcn/ui

### Phase 5: Flow Builder

- [ ] Implement StartNode component
- [ ] Implement MessageNode component
- [ ] Implement UserReplyNode component
- [ ] Implement PromptNode component
- [ ] Implement ConditionNode component
- [ ] Implement StageNode component
- [ ] Implement ImageNode component
- [ ] Implement VideoNode component
- [ ] Implement AudioNode component
- [ ] Implement DelayNode component
- [ ] Implement flow save/load functionality
- [ ] Implement flow preview
- [ ] Implement flow activation/deactivation

### Phase 6: WhatsApp Integration

- [ ] Implement Wablas provider
- [ ] Implement Whacenter provider
- [ ] Implement WAHA provider
- [ ] Implement webhook handlers
- [ ] Implement message sending (text)
- [ ] Implement media sending (image, video, audio)
- [ ] Test webhooks with each provider

### Phase 7: AI Integration

- [ ] Set up OpenRouter API client
- [ ] Implement AI prompt execution
- [ ] Implement conversation history management
- [ ] Implement AI response parsing
- [ ] Test with different AI models

### Phase 8: Real-time Features

- [ ] Implement WebSocket server
- [ ] Implement WebSocket client (frontend)
- [ ] Implement real-time conversation updates
- [ ] Implement real-time flow execution updates
- [ ] Test WebSocket reliability

### Phase 9: Analytics & Reporting

- [ ] Implement analytics data aggregation
- [ ] Implement dashboard API endpoints
- [ ] Implement analytics charts (frontend)
- [ ] Implement lead tracking
- [ ] Implement stage breakdown
- [ ] Implement daily stats

### Phase 10: Deployment

- [ ] Create Dockerfile (multi-stage)
- [ ] Create railway.toml
- [ ] Set up Railway project
- [ ] Configure environment variables
- [ ] Test Railway deployment
- [ ] Set up custom domain (optional)
- [ ] Test all features in production

### Phase 11: Testing & Optimization

- [ ] Test all API endpoints
- [ ] Test all WhatsApp providers
- [ ] Test flow execution with complex flows
- [ ] Test AI conversations
- [ ] Test WebSocket reliability
- [ ] Test session locking
- [ ] Load testing (concurrent users)
- [ ] Optimize database queries
- [ ] Implement caching (Redis optional)
- [ ] Implement rate limiting

### Phase 12: Documentation

- [ ] Document API endpoints (Swagger/OpenAPI)
- [ ] Document database schema
- [ ] Document flow node types
- [ ] Create user guide
- [ ] Create admin guide
- [ ] Create deployment guide

---

## CRITICAL DIFFERENCES IN NEW BUILD

### Key Changes from Current System

1. **NO PostgreSQL Direct Connection**
   - Use ONLY Supabase REST API
   - No `database/sql` package
   - No connection pooling issues
   - No IPv6 connection errors

2. **Simplified Architecture**
   - Remove dual repository implementations
   - Single source of truth: Supabase REST
   - Cleaner code structure
   - Easier to maintain

3. **Railway-Optimized from Day 1**
   - Health check endpoint in first 10 lines
   - Server starts immediately
   - No blocking initialization
   - All services initialize in background

4. **Frontend Build Clarity**
   - Clean Vite configuration
   - Explicit asset directory (/assets/)
   - No MIME type confusion
   - Clear environment variable handling

5. **Better Error Handling**
   - Graceful degradation
   - Fallback for missing services
   - Clear error messages
   - User-friendly error pages

### What to Keep from Current System

1. **Flow Execution Logic** - Works well, keep the same
2. **WhatsApp Provider Abstraction** - Clean pattern
3. **Session Locking** - Prevents duplicates, essential
4. **Conversation History Management** - Well-designed
5. **WebSocket Real-time Updates** - Users love it
6. **Analytics Aggregation** - Useful insights

### What to Discard

1. **SQL-based Repositories** - Use only Supabase REST
2. **PostgreSQL Connection Retry Logic** - Not needed
3. **Complex Database Initialization** - Supabase SDK is simple
4. **Multiple Build Scripts** - Use only Dockerfile
5. **Legacy `wasapbot` Table** - Consolidate into `ai_whatsapp`

---

## ESTIMATED REBUILD TIMELINE

**Optimistic (Full-time, experienced developer):**
- Phase 1-2: 1 day
- Phase 3-4: 3 days
- Phase 5-6: 2 days
- Phase 7-8: 2 days
- Phase 9-12: 2 days
- **Total: ~10 days**

**Realistic (Part-time or learning as you go):**
- Phase 1-2: 2 days
- Phase 3-4: 1 week
- Phase 5-6: 4 days
- Phase 7-8: 4 days
- Phase 9-12: 5 days
- **Total: ~3-4 weeks**

---

## CONTACT & SUPPORT

For questions about this documentation or the rebuild process, refer to:
- Supabase Docs: https://supabase.com/docs
- Fiber Framework: https://docs.gofiber.io/
- React Flow: https://reactflow.dev/
- Railway Docs: https://docs.railway.app/

---

**END OF DOCUMENTATION**

This documentation captures the complete architecture, business logic, and implementation details of the current Chatbot Automation system. Use this as a reference when rebuilding the system from scratch with a Supabase-only architecture.
