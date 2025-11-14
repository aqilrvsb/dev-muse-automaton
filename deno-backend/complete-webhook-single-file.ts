import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
const DEBOUNCE_DELAY_MS = parseInt(Deno.env.get("DEBOUNCE_DELAY_MS") || "4000");
const WAHA_API_URL = Deno.env.get("WAHA_API_URL") || "https://waha-plus-production-705f.up.railway.app";
const WAHA_API_KEY = Deno.env.get("WAHA_API_KEY") || "dckr_pat_vxeqEu_CqRi5O3CBHnD7FxhnBz0";

// Initialize Supabase clients
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Initialize Deno KV for message queue
const kv = await Deno.openKv();

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Types
interface QueuedMessage {
  messages: Array<{
    phone: string;
    message: string;
    name: string;
    timestamp: number;
  }>;
  timer?: number;
  deviceId: string;
  webhookId: string;
  provider: string;
}

interface WebhookPayload {
  event: string;
  session: string;
  payload: {
    from: string;
    body?: string;
    name?: string;
    timestamp?: number;
    _data?: {
      Info?: {
        PushName?: string;
      };
      notifyName?: string;
      pushname?: string;
    };
  };
}

// ============================================================================
// DEBOUNCE SERVICE
// ============================================================================

async function queueMessageForDebouncing(params: {
  deviceId: string;
  webhookId: string;
  phone: string;
  message: string;
  name: string;
  provider: string;
}): Promise<void> {
  const { deviceId, webhookId, phone, message, name, provider } = params;

  // Get current queue for this device + phone combination
  const queueKey = ["message_queue", deviceId, phone];
  const result = await kv.get<QueuedMessage>(queueKey);
  const existingQueue = result.value;

  if (existingQueue && existingQueue.timer) {
    // Cancel existing timer
    clearTimeout(existingQueue.timer);
    console.log(`⏱️  Existing timer cancelled, restarting debounce...`);
  }

  // Add new message to queue
  const updatedMessages = [
    ...(existingQueue?.messages || []),
    {
      phone,
      message,
      name,
      timestamp: Date.now(),
    },
  ];

  console.log(
    `📬 Message queued for debouncing (${DEBOUNCE_DELAY_MS}ms delay)`
  );

  // Set new timer
  const timer = setTimeout(async () => {
    console.log(`⏰ Timer EXPIRED! Processing ${updatedMessages.length} messages...`);

    // Combine all messages
    const combinedMessage = updatedMessages.map((m) => m.message).join("\n");

    // Execute flow
    await executePromptBasedFlow({
      deviceId,
      webhookId,
      phone,
      message: combinedMessage,
      name: updatedMessages[0].name,
      provider,
    });

    // Clear queue
    await kv.delete(queueKey);
  }, DEBOUNCE_DELAY_MS);

  // Save updated queue
  await kv.set(queueKey, {
    messages: updatedMessages,
    timer,
    deviceId,
    webhookId,
    provider,
  });
}

// ============================================================================
// PROMPT-BASED FLOW EXECUTION
// ============================================================================

async function executePromptBasedFlow(params: {
  deviceId: string;
  webhookId: string;
  phone: string;
  message: string;
  name: string;
  provider: string;
}): Promise<void> {
  const { deviceId, webhookId, phone, message, name, provider } = params;

  console.log(`\n🚀 === PROMPT-BASED FLOW EXECUTION START ===`);
  console.log(`📱 Device ID: ${deviceId}`);
  console.log(`📞 Phone: ${phone}`);
  console.log(`💬 Message: ${message}`);

  // Step 1: Get device details
  const { data: device, error: deviceError } = await supabaseAdmin
    .from("device_setting")
    .select("*")
    .eq("device_id", deviceId)
    .eq("instance", webhookId)  // ✅ FIXED: Changed from webhook_id to instance
    .single();

  if (deviceError || !device) {
    console.error("❌ Device not found:", deviceError);
    return;
  }

  console.log(`✅ Device found: ${device.device_id}`);

  // Step 2: Get prompt from prompts table
  const { data: prompt, error: promptError } = await supabaseAdmin
    .from("prompts")
    .select("*")
    .eq("device_id", deviceId)
    .single();

  if (promptError || !prompt) {
    console.error("❌ No prompt configured for this device");
    return;
  }

  console.log(`✅ Found prompt: ${prompt.prompts_name}`);

  // Step 3: Check if conversation exists
  const { data: existingConversation } = await supabaseAdmin
    .from("ai_whatsapp")
    .select("*")
    .eq("device_id", device.device_id)
    .eq("prospect_num", phone)
    .single();

  let conversation = existingConversation;

  // Step 4: Create or update conversation
  if (!conversation) {
    // Create new conversation
    const today = new Date().toISOString().split("T")[0]; // Y-m-d format

    const conversationData = {
      device_id: device.device_id,
      prospect_num: phone,
      prospect_name: name || "Unknown",
      niche: prompt.niche || "",  // ✅ Get niche from prompts table
      intro: "",
      stage: null,  // ✅ FIXED: Default to null instead of "active"
      conv_current: message,
      conv_last: "",
      human: 0,
      date_insert: today,
      user_id: device.user_id,
      detail: "",
    };

    const { data: newConversation, error: createError } = await supabaseAdmin
      .from("ai_whatsapp")
      .insert(conversationData)
      .select()
      .single();

    if (createError) {
      console.error("❌ Failed to create conversation:", createError);
      return;
    }

    conversation = newConversation;
    console.log(`✅ New conversation created: ${conversation.id_prospect}`);
  } else {
    // Update existing conversation - just update conv_current
    // DON'T touch conv_last here - it will be updated later with proper User:/Bot: format
    await supabaseAdmin
      .from("ai_whatsapp")
      .update({
        conv_current: message,
      })
      .eq("id_prospect", conversation.id_prospect);

    console.log(`✅ Conversation updated: ${conversation.id_prospect}`);

    // Refresh conversation data
    const { data: updatedConv } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("*")
      .eq("id_prospect", conversation.id_prospect)
      .single();

    conversation = updatedConv || conversation;
  }

  // Step 4.5: Check processing lock and insert
  const { data: existingProcess } = await supabaseAdmin
    .from("processing_tracker")
    .select("*")
    .eq("id_prospect", conversation.id_prospect)
    .eq("flow_type", "Chatbot AI")
    .single();

  if (existingProcess) {
    console.log(`⚠️  Process already running for id_prospect: ${conversation.id_prospect}, skipping execution`);
    return;
  }

  console.log(`✅ No existing process, proceeding with execution`);

  // Insert processing lock record
  const { error: insertLockError } = await supabaseAdmin
    .from("processing_tracker")
    .insert({
      id_prospect: conversation.id_prospect,
      flow_type: "Chatbot AI",
      created_at: new Date().toISOString(),
    });

  if (insertLockError) {
    console.error("❌ Failed to insert processing lock:", insertLockError);
    return;
  }

  console.log(`🔒 Processing lock created for id_prospect: ${conversation.id_prospect}`);

  // Wrap everything in try/finally to ensure lock is released
  try {
    // Step 5: Generate AI response
    console.log(`🤖 Generating AI response with prompt: ${prompt.prompts_name}`);

    // Build system content with instructions
    const systemContent = (prompt.prompts_data || "You are a helpful assistant.") + `

### Instructions:
1. If the current stage is null or undefined, default to the first stage.
2. Always analyze the user's input to determine the appropriate stage. If the input context is unclear, guide the user within the default stage context.
3. Follow all rules and steps strictly. Do not skip or ignore any rules or instructions.

4. **Do not repeat the same sentences or phrases that have been used in the recent conversation history.**
5. If the input contains the phrase "I want this section in add response format [onemessage]":
   - Add the \`Jenis\` field with the value \`onemessage\` at the item level for each text response.
   - The \`Jenis\` field is only added to \`text\` types within the \`Response\` array.
   - If the directive is not present, omit the \`Jenis\` field entirely.

### Response Format:
{
  "Stage": "[Stage]",  // Specify the current stage explicitly.
  "Response": [
    {"type": "text", "Jenis": "onemessage", "content": "Provide the first response message here."},
    {"type": "image", "content": "https://example.com/image1.jpg"},
    {"type": "text", "Jenis": "onemessage", "content": "Provide the second response message here."}
  ]
}

### Example Response:
// If the directive is present
{
  "Stage": "Problem Identification",
  "Response": [
    {"type": "text", "Jenis": "onemessage", "content": "Maaf kak, Layla kena reconfirm balik dulu masalah utama anak akak ni."},
    {"type": "text", "Jenis": "onemessage", "content": "Kurang selera makan, sembelit, atau kerap demam?"}
  ]
}

// If the directive is NOT present
{
  "Stage": "Problem Identification",
  "Response": [
    {"type": "text", "content": "Maaf kak, Layla kena reconfirm balik dulu masalah utama anak akak ni."},
    {"type": "text", "content": "Kurang selera makan, sembelit, atau kerap demam?"}
  ]
}

### Important Rules:
1. **Include the \`Stage\` field in every response**:
   - The \`Stage\` field must explicitly specify the current stage.
   - If the stage is unclear or missing, default to first stage.

2. **Use the Correct Response Format**:
   - Divide long responses into multiple short "text" segments for better readability.
   - Include all relevant images provided in the input, interspersed naturally with text responses.
   - If multiple images are provided, create separate \`image\` entries for each.

3. **Dynamic Field for [onemessage]**:
   - If the input specifies "I want this section in add response format [onemessage]":
      - Add \`"Jenis": "onemessage"\` to each \`text\` type in the \`Response\` array.
   - If the directive is not present, omit the \`Jenis\` field entirely.
   - Non-text types like \`image\` never include the \`Jenis\` field.
`;

    const lastText = conversation.conv_last || "";
    const currentText = message;

    // Use OpenRouter API key and model from device settings
    const aiResponseRaw = await generateAIResponse(
      systemContent,
      lastText,
      currentText,
      device.api_key,
      device.api_key_option || "openai/gpt-4o-mini"
    );

    console.log(`✅ AI Response Raw:`, aiResponseRaw);

    // Parse AI response JSON
    let aiResponse;
    try {
      aiResponse = JSON.parse(aiResponseRaw);
      console.log(`✅ AI Response Parsed:`, JSON.stringify(aiResponse, null, 2));
    } catch (error) {
      console.error(`❌ Failed to parse AI response:`, error);
      aiResponse = {
        Stage: "Unknown",
        Response: [
          { type: "text", content: aiResponseRaw }
        ]
      };
    }

    // Step 6: Process and send responses
    const responses = aiResponse.Response || [];
    let allSentMessages: string[] = [];
    const MESSAGE_DELAY_MS = 5000; // 5 seconds delay between messages

    for (let i = 0; i < responses.length; i++) {
      const item = responses[i];

      if (item.type === "text") {
        // Send text message
        console.log(`📤 Sending message ${i + 1}/${responses.length} (text)`);
        await sendWhatsAppMessage({
          provider,
          device,
          phone,
          message: item.content,
        });
        allSentMessages.push(`Bot: ${item.content}`);

      } else if (item.type === "image" && item.content) {
        // Send image
        console.log(`📤 Sending message ${i + 1}/${responses.length} (image)`);
        await sendWhatsAppMedia({
          provider,
          device,
          phone,
          mediaUrl: item.content,
          mediaType: "image",
          caption: "",
        });
        allSentMessages.push(`Bot: ${item.content}`);

      } else if (item.type === "video" && item.content) {
        // Send video
        console.log(`📤 Sending message ${i + 1}/${responses.length} (video)`);
        await sendWhatsAppMedia({
          provider,
          device,
          phone,
          mediaUrl: item.content,
          mediaType: "video",
          caption: "",
        });
        allSentMessages.push(`Bot: ${item.content}`);
      }

      // Add delay between messages (except after the last message)
      if (i < responses.length - 1) {
        console.log(`⏱️  Waiting ${MESSAGE_DELAY_MS}ms (${MESSAGE_DELAY_MS / 1000}s) before next message...`);
        await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY_MS));
      }
    }

    // Update conv_last - Append to existing conversation history
    const { data: currentConv } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("conv_last")
      .eq("id_prospect", conversation.id_prospect)
      .single();

    let convLast = currentConv?.conv_last || "";

    // Add user messages - split multi-line messages and add User: prefix to each line
    const userMessages = message.split("\n").filter(line => line.trim() !== "");
    for (const userMsg of userMessages) {
      const userLine = `User: ${userMsg}`;
      if (convLast) {
        convLast += "\n" + userLine;
      } else {
        convLast = userLine;
      }
    }

    // Add all bot responses
    for (const botMsg of allSentMessages) {
      convLast += "\n" + botMsg;
    }

    // Update conversation with conv_last and stage from AI response
    await supabaseAdmin
      .from("ai_whatsapp")
      .update({
        conv_last: convLast,
        stage: aiResponse.Stage || null,  // ✅ FIXED: Update stage from AI response
      })
      .eq("id_prospect", conversation.id_prospect);

    console.log(`✅ Updated conv_last and stage (${aiResponse.Stage}) for conversation`);

    console.log(`✅ === PROMPT-BASED FLOW EXECUTION COMPLETE ===\n`);
  } catch (error) {
    console.error("❌ Flow execution error:", error);
  } finally {
    // Step 7: Delete processing lock record (always execute, even on error)
    const { error: deleteLockError } = await supabaseAdmin
      .from("processing_tracker")
      .delete()
      .eq("id_prospect", conversation.id_prospect)  // ✅ FIXED: Use id_prospect from conversation
      .eq("flow_type", "Chatbot AI");

    if (deleteLockError) {
      console.error("❌ Failed to delete processing lock:", deleteLockError);
    } else {
      console.log(`🔓 Processing lock released for id_prospect: ${conversation.id_prospect}`);
    }
  }
}

// ============================================================================
// AI RESPONSE GENERATION
// ============================================================================

async function generateAIResponse(
  systemContent: string,
  lastText: string,
  currentText: string,
  openrouterApiKey: string,
  aiModel: string
): Promise<string> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: "system",
            content: systemContent,
          },
          {
            role: "assistant",
            content: lastText,
          },
          {
            role: "user",
            content: currentText,
          },
        ],
        temperature: 0.67,
        top_p: 1,
        repetition_penalty: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("❌ AI generation error:", error);
    return "Sorry, I encountered an error processing your message.";
  }
}

// ============================================================================
// WHATSAPP MESSAGE SENDING
// ============================================================================

async function sendWhatsAppMessage(params: {
  provider: string;
  device: any;
  phone: string;
  message: string;
}): Promise<void> {
  const { provider, device, phone, message } = params;

  if (provider !== "waha") {
    console.error(`❌ Unsupported provider: ${provider}`);
    return;
  }

  try {
    // Use hardcoded WAHA API URL
    const wahaUrl = `${WAHA_API_URL}/api/sendText`;

    const response = await fetch(wahaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": WAHA_API_KEY,
      },
      body: JSON.stringify({
        session: device.instance,  // ✅ FIXED: Changed from device.webhook_id to device.instance
        chatId: `${phone}@c.us`,
        text: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`WAHA API error: ${response.statusText}`);
    }

    console.log(`✅ WAHA text message sent to ${phone}`);
  } catch (error) {
    console.error("❌ Failed to send WhatsApp message:", error);
  }
}

async function sendWhatsAppMedia(params: {
  provider: string;
  device: any;
  phone: string;
  mediaUrl: string;
  mediaType: string;
  caption: string;
}): Promise<void> {
  const { provider, device, phone, mediaUrl, mediaType, caption } = params;

  if (provider !== "waha") {
    console.error(`❌ Unsupported provider: ${provider}`);
    return;
  }

  try {
    let endpoint = "";
    let payload: any = {};

    const chatId = `${phone}@c.us`;
    const session = device.instance;

    // Determine media type by extension
    const ext = mediaUrl.split(".").pop()?.toLowerCase() || "";

    if (ext === "mp4" || mediaType === "video") {
      // Video
      endpoint = `${WAHA_API_URL}/api/sendVideo`;
      payload = {
        session,
        chatId,
        file: {
          mimetype: "video/mp4",
          url: mediaUrl,
          filename: "Video",
        },
        caption: caption || "",
      };
    } else if (ext === "mp3" || ext === "wav" || mediaType === "audio") {
      // Audio/File
      endpoint = `${WAHA_API_URL}/api/sendFile`;
      payload = {
        session,
        chatId,
        file: {
          mimetype: "audio/mp3",
          url: mediaUrl,
          filename: "Audio",
        },
        caption: caption || "",
      };
    } else {
      // Image (default)
      endpoint = `${WAHA_API_URL}/api/sendImage`;
      payload = {
        session,
        chatId,
        file: {
          mimetype: "image/jpeg",
          url: mediaUrl,
          filename: "Image",
        },
        caption: caption || "",
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": WAHA_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`WAHA API error: ${response.statusText}`);
    }

    console.log(`✅ WAHA ${mediaType} sent to ${phone}`);
  } catch (error) {
    console.error(`❌ Failed to send WhatsApp ${mediaType}:`, error);
  }
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

async function handleWebhook(request: Request): Promise<Response> {
  // Extract device_id and instance from URL path
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter((p) => p);

  if (pathParts.length < 2) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid webhook URL format" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const deviceId = pathParts[0];
  const webhookId = pathParts[1];

  console.log(`\n📥 Webhook: POST /${deviceId}/${webhookId}`);

  try {
    // Parse webhook payload
    const payload: WebhookPayload = await request.json();

    console.log(`📦 Event: ${payload.event}`);
    console.log(`📦 Payload:`, JSON.stringify(payload.payload, null, 2));

    // Only process incoming messages
    if (payload.event !== "message") {
      return new Response(
        JSON.stringify({ success: true, message: "Event ignored" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Get device from database
    const { data: device, error: deviceError } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("device_id", deviceId)
      .eq("instance", webhookId)  // ✅ FIXED: Changed from webhook_id to instance
      .single();

    if (deviceError || !device) {
      console.error("❌ Device not found:", deviceError);
      return new Response(
        JSON.stringify({ success: false, error: "Device not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`✅ Device found: ${device.device_id} (Provider: ${device.provider})`);

    // Extract message details
    const phone = payload.payload.from.replace("@c.us", "");
    const message = payload.payload.body || "";

    // Extract name from multiple possible locations in WAHA webhook
    const name = payload.payload._data?.Info?.PushName ||
                 payload.payload._data?.notifyName ||
                 payload.payload._data?.pushname ||
                 payload.payload.name ||
                 "";

    if (!message) {
      console.log("⚠️  Empty message, ignoring");
      return new Response(
        JSON.stringify({ success: true, message: "Empty message ignored" }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`📱 From: ${name} (${phone})`);
    console.log(`💬 Message: ${message}`);

    // Queue message for debouncing
    await queueMessageForDebouncing({
      deviceId: device.device_id,
      webhookId: device.instance,  // ✅ FIXED: Changed from device.webhook_id to device.instance
      phone,
      message,
      name: name || "",
      provider: device.provider,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Message queued for processing",
        device_id: device.device_id,
        instance: device.instance,  // ✅ FIXED: Changed from webhook_id to instance
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================================================
// AUTH HANDLERS
// ============================================================================

async function handleLogin(request: Request): Promise<Response> {
  try {
    const { email, password } = await request.json();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        user: data.user,
        session: data.session,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 401, headers: corsHeaders }
    );
  }
}

async function handleRegister(request: Request): Promise<Response> {
  try {
    const { email, password, full_name, username } = await request.json();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    if (!authData.user) {
      throw new Error("User creation failed");
    }

    // Create user profile
    const { error: profileError } = await supabaseAdmin.from("user").insert({
      id: authData.user.id,
      email,
      full_name,
      username,
      role: "user",
      is_active: true,
    });

    if (profileError) throw profileError;

    return new Response(
      JSON.stringify({
        success: true,
        user: authData.user,
        session: authData.session,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 400, headers: corsHeaders }
    );
  }
}

async function handleGetUser(request: Request): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await supabase.auth.getUser(token);

    if (error) throw error;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (profileError) throw profileError;

    return new Response(
      JSON.stringify({ success: true, user: profile }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 401, headers: corsHeaders }
    );
  }
}

// ============================================================================
// MAIN SERVER
// ============================================================================

serve(async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  console.log(`${method} ${path}`);

  try {
    // Health check
    if (path === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "dev-muse-automaton-deno" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Auth endpoints
    if (path === "/auth/login" && method === "POST") {
      return await handleLogin(request);
    }

    if (path === "/auth/register" && method === "POST") {
      return await handleRegister(request);
    }

    if (path === "/auth/user" && method === "GET") {
      return await handleGetUser(request);
    }

    // Webhook endpoint - matches pattern /:device_id/:instance
    if (method === "POST" && path.split("/").filter((p) => p).length >= 2) {
      return await handleWebhook(request);
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({ success: false, error: "Not found" }),
      { status: 404, headers: corsHeaders }
    );
  } catch (error) {
    console.error("❌ Server error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
});

console.log("✅ Debounce service initialized");
console.log(`🚀 Dev Muse Automaton Deno Backend Started!`);
console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
console.log(`⏱️  Debounce delay: ${DEBOUNCE_DELAY_MS}ms`);
