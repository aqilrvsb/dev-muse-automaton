/**
 * Dev Muse Automaton - Complete Backend (Single File)
 *
 * Deploy this single file to Deno Deploy
 * All handlers, services, and utilities combined
 *
 * WhatsApp Chatbot Automation Platform
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import * as jose from "https://deno.land/x/jose@v5.2.0/index.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://bjnjucwpwdzgsnqmpmff.supabase.co";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const config = {
  jwtSecret: Deno.env.get("JWT_SECRET") || "chatbot-automation-secret-key-change-in-production",
  billplzApiKey: Deno.env.get("BILLPLZ_API_KEY") || "",
  billplzCollectionId: Deno.env.get("BILLPLZ_COLLECTION_ID") || "",
  debounceDelayMs: parseInt(Deno.env.get("DEBOUNCE_DELAY_MS") || "4000"),
  serverUrl: Deno.env.get("SERVER_URL") || "http://localhost:8080",
};

const secret = new TextEncoder().encode(config.jwtSecret);
const kv = await Deno.openKv();

// ============================================================================
// JWT UTILITIES
// ============================================================================

async function generateToken(payload: { user_id: string; email: string }): Promise<string> {
  const jwt = await new jose.SignJWT({
    user_id: payload.user_id,
    email: payload.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  return jwt;
}

async function verifyToken(token: string): Promise<any | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch (error) {
    console.error("JWT verification failed:", error.message);
    return null;
  }
}

function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    return parts[1];
  }
  return authHeader;
}

async function getUserFromRequest(req: Request): Promise<any | null> {
  const authHeader = req.headers.get("Authorization");
  const token = extractTokenFromHeader(authHeader);
  if (!token) return null;
  return await verifyToken(token);
}

// ============================================================================
// WEBHOOK PARSER
// ============================================================================

function cleanPhoneNumber(phone: string): string {
  return phone
    .replace(/@c\.us/g, "")
    .replace(/@s\.whatsapp\.net/g, "")
    .replace(/@g\.us/g, "")
    .replace(/\s/g, "")
    .replace(/-/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/\+/g, "");
}

async function parseWebhookPayload(payload: any, provider: string): Promise<any | null> {
  switch (provider.toLowerCase()) {
    case "waha":
      return parseWAHAWebhook(payload);
    case "wablas":
      return parseWablasWebhook(payload);
    case "whacenter":
      return parseWhaCenterWebhook(payload);
    default:
      return parseGenericWebhook(payload);
  }
}

function parseWAHAWebhook(payload: any): any | null {
  const event = payload.event || payload.payload?.event;
  if (event !== "message" && event !== "messages.upsert") return null;
  const data = payload.payload || payload;
  if (data.fromMe === true || data.payload?.fromMe === true) return null;
  const from = data.from || data.payload?.from || "";
  const body = data.body || data.message?.conversation || data.payload?.body || "";
  const notifyName = data._data?.notifyName || data.payload?._data?.notifyName || "";
  const hasMedia = data.hasMedia || data.payload?.hasMedia || false;
  if (hasMedia) return null;
  return {
    phone: cleanPhoneNumber(from),
    message: body,
    name: notifyName,
    messageType: "text"
  };
}

function parseWablasWebhook(payload: any): any | null {
  if (payload.isGroup === true) return null;
  const phone = payload.phone || "";
  const message = payload.message || "";
  const pushname = payload.pushname || payload.sender_name || "";
  if (!phone || !message) return null;
  return {
    phone: cleanPhoneNumber(phone),
    message,
    name: pushname,
    messageType: "text"
  };
}

function parseWhaCenterWebhook(payload: any): any | null {
  const from = payload.from || payload.sender || "";
  const text = payload.text || payload.message || payload.body || "";
  const name = payload.name || payload.pushname || "";
  const type = payload.type || "text";
  if (type !== "text" && type !== "chat") return null;
  if (!from || !text) return null;
  return {
    phone: cleanPhoneNumber(from),
    message: text,
    name,
    messageType: type
  };
}

function parseGenericWebhook(payload: any): any | null {
  const phone = payload.phone || payload.from || payload.sender || payload.wa_id || "";
  const message = payload.message || payload.body || payload.text || payload.msg || "";
  const name = payload.name || payload.pushname || payload.sender_name || payload.notifyName || "";
  if (!phone || !message) return null;
  return {
    phone: cleanPhoneNumber(phone),
    message,
    name,
    messageType: "text"
  };
}

// ============================================================================
// WHATSAPP PROVIDER
// ============================================================================

async function sendWhatsAppMessage(request: any, device: any): Promise<any> {
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

async function sendViaWAHA(request: any, device: any): Promise<any> {
  const { phone, message, mediaType, mediaUrl } = request;
  const baseUrl = device.api_key;
  const session = device.instance || "default";
  try {
    let endpoint = `${baseUrl}/api/sendText`;
    let body: any = {
      session,
      chatId: `${phone}@c.us`,
      text: message,
    };
    if (mediaType && mediaUrl) {
      if (mediaType === "image") {
        endpoint = `${baseUrl}/api/sendImage`;
        body = { session, chatId: `${phone}@c.us`, url: mediaUrl, caption: message };
      } else if (mediaType === "file") {
        endpoint = `${baseUrl}/api/sendFile`;
        body = { session, chatId: `${phone}@c.us`, url: mediaUrl, filename: "file", caption: message };
      }
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`WAHA error: ${response.status}`);
    const result = await response.json();
    console.log(`✅ WAHA message sent to ${phone}`);
    return { success: true, messageId: result.id || result.messageId };
  } catch (error) {
    console.error(`❌ WAHA send error:`, error);
    return { success: false, error: error.message };
  }
}

async function sendViaWablas(request: any, device: any): Promise<any> {
  const { phone, message, mediaType, mediaUrl } = request;
  const apiKey = device.api_key;
  const baseUrl = device.instance || "https://api.wablas.com";
  try {
    let endpoint = `${baseUrl}/api/send-message`;
    let body: any = { phone, message };
    if (mediaType && mediaUrl) {
      if (mediaType === "image") {
        endpoint = `${baseUrl}/api/send-image`;
        body = { phone, image: mediaUrl, caption: message };
      } else if (mediaType === "file") {
        endpoint = `${baseUrl}/api/send-document`;
        body = { phone, document: mediaUrl, caption: message };
      }
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": apiKey },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Wablas error: ${response.status}`);
    const result = await response.json();
    console.log(`✅ Wablas message sent to ${phone}`);
    return { success: true, messageId: result.data?.id || result.id };
  } catch (error) {
    console.error(`❌ Wablas send error:`, error);
    return { success: false, error: error.message };
  }
}

async function sendViaWhCenter(request: any, device: any): Promise<any> {
  const { phone, message, mediaType, mediaUrl } = request;
  const baseUrl = device.api_key;
  const deviceId = device.device_id;
  try {
    let endpoint = `${baseUrl}/send-message`;
    let body: any = { device_id: deviceId, number: phone, message };
    if (mediaType && mediaUrl) {
      if (mediaType === "image") {
        body.type = "image";
        body.url = mediaUrl;
      } else if (mediaType === "file") {
        body.type = "file";
        body.url = mediaUrl;
      }
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`WhCenter error: ${response.status}`);
    const result = await response.json();
    console.log(`✅ WhCenter message sent to ${phone}`);
    return { success: true, messageId: result.message_id };
  } catch (error) {
    console.error(`❌ WhCenter send error:`, error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// AI SERVICE
// ============================================================================

async function generateAICompletion(request: any, apiKey: string): Promise<any> {
  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push(...request.messages);
    const payload = {
      model: request.model,
      messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 1000,
    };
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://dev-muse-automaton.deno.dev",
        "X-Title": "Dev Muse Automaton",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`AI API error: ${response.status}`);
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    const usage = result.usage ? {
      promptTokens: result.usage.prompt_tokens || 0,
      completionTokens: result.usage.completion_tokens || 0,
      totalTokens: result.usage.total_tokens || 0,
    } : undefined;
    return { success: true, content, usage };
  } catch (error) {
    console.error(`❌ AI generation error:`, error);
    return { success: false, content: "", error: error.message };
  }
}

// ============================================================================
// DEBOUNCING SERVICE
// ============================================================================

async function queueMessageForDebouncing(params: any): Promise<void> {
  const { deviceId, webhookId, phone, message, name, provider } = params;
  const queueKey = ["message_queue", deviceId, phone];
  const now = Date.now();
  const result = await kv.get(queueKey);
  let queue: any;
  if (result.value) {
    queue = result.value;
    queue.messages.push({ message, timestamp: now });
    queue.lastMessageTime = now;
    queue.timerScheduled = now + config.debounceDelayMs;
    console.log(`📩 [${deviceId}/${phone}] Message ${queue.messages.length} added. Timer RESET.`);
  } else {
    queue = {
      deviceId,
      webhookId,
      phone,
      name: name || "",
      provider,
      messages: [{ message, timestamp: now }],
      lastMessageTime: now,
      timerScheduled: now + config.debounceDelayMs,
    };
    console.log(`🆕 [${deviceId}/${phone}] New queue created.`);
  }
  await kv.set(queueKey, queue);
  scheduleProcessing(deviceId, phone, queue.timerScheduled);
}

function scheduleProcessing(deviceId: string, phone: string, scheduledTime: number): void {
  const delay = scheduledTime - Date.now();
  if (delay > 0) {
    setTimeout(async () => {
      await checkAndProcess(deviceId, phone, scheduledTime);
    }, delay);
  }
}

async function checkAndProcess(deviceId: string, phone: string, scheduledTime: number): Promise<void> {
  const queueKey = ["message_queue", deviceId, phone];
  const result = await kv.get(queueKey);
  if (!result.value) {
    console.log(`⚠️ [${deviceId}/${phone}] Queue not found`);
    return;
  }
  const queue = result.value;
  const now = Date.now();
  if (queue.timerScheduled !== scheduledTime) {
    console.log(`⏭️ [${deviceId}/${phone}] Timer was reset`);
    return;
  }
  if (now >= queue.timerScheduled) {
    console.log(`⏰ [${deviceId}/${phone}] Timer EXPIRED! Processing...`);
    await processMessages(queue);
  }
}

async function processMessages(queue: any): Promise<void> {
  const { deviceId, webhookId, phone, name, messages, provider } = queue;
  try {
    const combinedMessage = messages.map((m: any) => m.message).join("\n");
    console.log(`📤 [${deviceId}/${phone}] Processing: ${combinedMessage}`);
    const result = await processFlowMessage({
      deviceId,
      webhookId,
      phone,
      name,
      message: combinedMessage,
      provider,
    });
    console.log(`✅ [${deviceId}/${phone}] Processing complete`);
    const queueKey = ["message_queue", deviceId, phone];
    await kv.delete(queueKey);
  } catch (error) {
    console.error(`❌ [${deviceId}/${phone}] Processing error:`, error);
    const queueKey = ["message_queue", deviceId, phone];
    await kv.delete(queueKey);
  }
}

// ============================================================================
// FLOW EXECUTION
// ============================================================================

async function processFlowMessage(params: any): Promise<any> {
  const { deviceId, webhookId, phone, name, message } = params;
  try {
    const { data: device } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("device_id", deviceId)
      .eq("webhook_id", webhookId)
      .single();
    if (!device) throw new Error("Device not found");
    let conversation = await getActiveConversation(deviceId, phone);
    if (!conversation) {
      conversation = await createNewConversation(device, phone, name, message);
    } else {
      await updateConversation(conversation, message);
    }
    const response = await handleSimpleAIResponse(device, phone, message, conversation);
    if (response) {
      await sendWhatsAppMessage({ deviceId: device.device_id, phone, message: response }, device);
      await updateConversationResponse(conversation, response);
    }
    return { success: true, responded: !!response };
  } catch (error) {
    console.error("Flow execution error:", error);
    return { success: false, responded: false, error: error.message };
  }
}

async function getActiveConversation(deviceId: string, phone: string): Promise<any> {
  const { data: aiConv } = await supabaseAdmin
    .from("ai_whatsapp")
    .select("*")
    .eq("id_device", deviceId)
    .eq("prospect_num", phone)
    .eq("execution_status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (aiConv) return aiConv;
  const { data: wasapConv } = await supabaseAdmin
    .from("wasapbot")
    .select("*")
    .eq("id_device", deviceId)
    .eq("prospect_num", phone)
    .eq("execution_status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return wasapConv || null;
}

async function createNewConversation(device: any, phone: string, name: string, message: string): Promise<any> {
  const now = new Date().toISOString();
  const { data: flow } = await supabaseAdmin
    .from("chatbot_flows")
    .select("id")
    .eq("id_device", device.id_device)
    .limit(1)
    .maybeSingle();
  const conversationData = {
    id_device: device.id_device,
    prospect_num: phone,
    prospect_name: name || "Unknown",
    niche: device.niche || "",
    flow_id: flow?.id || null,
    stage: "intro",
    conv_current: message,
    conv_last: "",
    execution_status: "active",
    waiting_for_reply: true,
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await supabaseAdmin
    .from("ai_whatsapp")
    .insert(conversationData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateConversation(conversation: any, message: string): Promise<void> {
  const tableName = conversation.id_prospect ? "ai_whatsapp" : "wasapbot";
  const idField = "id_prospect";
  await supabaseAdmin
    .from(tableName)
    .update({
      conv_last: conversation.conv_current || "",
      conv_current: message,
      updated_at: new Date().toISOString(),
      waiting_for_reply: true,
    })
    .eq(idField, conversation[idField]);
}

async function updateConversationResponse(conversation: any, response: string): Promise<void> {
  const tableName = conversation.id_prospect ? "ai_whatsapp" : "wasapbot";
  const idField = "id_prospect";
  await supabaseAdmin
    .from(tableName)
    .update({
      balas: response,
      waiting_for_reply: false,
      updated_at: new Date().toISOString(),
    })
    .eq(idField, conversation[idField]);
}

async function handleSimpleAIResponse(device: any, phone: string, message: string, conversation: any): Promise<string | null> {
  try {
    const aiModel = device.api_key_option || "openai/gpt-4.1";
    const apiKey = device.api_key || "";
    if (!apiKey) {
      return "Maaf, AI belum dikonfigurasi. Silakan hubungi admin.";
    }
    const conversationHistory = `Previous: ${conversation?.conv_last || ""}\n`;
    const systemPrompt = `You are a helpful assistant. Respond naturally to the user.

Previous Conversation:
${conversationHistory}`;
    const result = await generateAICompletion(
      {
        model: aiModel,
        messages: [{ role: "user", content: message }],
        systemPrompt,
        temperature: 0.7,
        maxTokens: 500,
      },
      apiKey
    );
    if (!result.success) {
      return "Maaf, saya mengalami kendala teknis. Silakan coba lagi nanti.";
    }
    return result.content;
  } catch (error) {
    console.error("Simple AI response error:", error);
    return "Maaf, saya mengalami kendala teknis. Silakan coba lagi nanti.";
  }
}

// ============================================================================
// HTTP HANDLERS
// ============================================================================

async function handleWebhook(req: Request, deviceId: string, webhookId: string, method: string): Promise<Response> {
  try {
    const { data: device, error: deviceError } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("device_id", deviceId)
      .eq("webhook_id", webhookId)
      .single();
    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ success: false, error: "Device not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (method === "GET") {
      const url = new URL(req.url);
      const challenge = url.searchParams.get("hub.challenge");
      if (challenge) {
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      return new Response(
        JSON.stringify({ success: true, message: "Webhook verified", device_id: device.device_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (method === "POST") {
      const rawPayload = await req.json();
      const parsed = await parseWebhookPayload(rawPayload, device.provider);
      if (!parsed || !parsed.message) {
        return new Response(
          JSON.stringify({ success: true, message: "Event ignored", processed: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await queueMessageForDebouncing({
        deviceId: device.device_id,
        webhookId: device.webhook_id,
        phone: parsed.phone,
        message: parsed.message,
        name: parsed.name || "",
        provider: device.provider,
      });
      return new Response(
        JSON.stringify({ success: true, message: "Message queued", processed: true, debounced: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleLogin(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { email, password } = body;
    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing email or password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: user, error: userError } = await supabaseAdmin
      .from("user")
      .select("*")
      .eq("email", email)
      .single();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!user.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Account is inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    await supabaseAdmin.from("user").update({ last_login: new Date().toISOString() }).eq("id", user.id);
    const token = await generateToken({ user_id: user.id, email: user.email });
    const { password: _, ...userWithoutPassword } = user;
    return new Response(
      JSON.stringify({ success: true, message: "Login successful", data: { user: userWithoutPassword, token } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleRegister(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { email, password, full_name, phone, gmail } = body;
    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: existingUser } = await supabaseAdmin.from("user").select("id").eq("email", email).single();
    if (existingUser) {
      return new Response(
        JSON.stringify({ success: false, error: "User already exists" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const hashedPassword = await bcrypt.hash(password);
    const { data: user, error: createError } = await supabaseAdmin
      .from("user")
      .insert({
        email,
        password: hashedPassword,
        full_name,
        phone: phone || null,
        gmail: gmail || null,
        status: "Trial",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, email, full_name, status, is_active")
      .single();
    if (createError) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create user", details: createError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = await generateToken({ user_id: user.id, email: user.email });
    return new Response(
      JSON.stringify({ success: true, message: "User registered", data: { user, token } }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// MAIN SERVER
// ============================================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;
  console.log(`${method} ${pathname}`);
  try {
    if (pathname === "/health" || pathname === "/healthz") {
      return new Response(
        JSON.stringify({ status: "ok", service: "dev-muse-automaton-deno" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const webhookMatch = pathname.match(/^\/([^\/]+)\/([^\/]+)$/);
    if (webhookMatch) {
      const deviceId = webhookMatch[1];
      const webhookId = webhookMatch[2];
      return await handleWebhook(req, deviceId, webhookId, method);
    }
    if (pathname === "/api/auth/login" && method === "POST") {
      return await handleLogin(req);
    }
    if (pathname === "/api/auth/register" && method === "POST") {
      return await handleRegister(req);
    }
    return new Response(
      JSON.stringify({ success: false, error: "Not Found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Server error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

console.log("🚀 Dev Muse Automaton Deno Backend Started!");
console.log(`📍 Supabase URL: ${supabaseUrl}`);
console.log(`⏱️  Debounce delay: ${config.debounceDelayMs}ms`);
console.log(`💚 Health check: GET /health`);
console.log(`📥 Webhook pattern: /:deviceId/:webhookId`);
