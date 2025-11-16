/**
 * WhatsApp Chatbot Webhook Handler
 *
 * Deployed on Deno Deploy (pening-bot.deno.dev)
 *
 * Pattern: https://pening-bot.deno.dev/{device_id}/{webhook_id}
 *
 * Supports:
 * - GET: Webhook verification (returns hub.challenge)
 * - POST: WhatsApp messages (processes and replies)
 *
 * NO LOGIN REQUIRED - Device verification by URL pattern only
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

// ============================================================================
// CONFIGURATION
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://bjnjucwpwdzgsnqmpmff.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const config = {
  debounceDelayMs: parseInt(Deno.env.get("DEBOUNCE_DELAY_MS") || "4000"),
};

const kv = await Deno.openKv();

// ============================================================================
// WEBHOOK PARSER (Multi-Provider Support)
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
// WHATSAPP PROVIDER (Send Messages)
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
  const { phone, message } = request;
  const baseUrl = device.api_key;
  const session = device.instance || "default";
  try {
    const endpoint = `${baseUrl}/api/sendText`;
    const body = {
      session,
      chatId: `${phone}@c.us`,
      text: message,
    };
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
  const { phone, message } = request;
  const apiKey = device.api_key;
  const baseUrl = device.instance || "https://api.wablas.com";
  try {
    const endpoint = `${baseUrl}/api/send-message`;
    const body = { phone, message };
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
  const { phone, message } = request;
  const baseUrl = device.api_key;
  const deviceId = device.device_id;
  try {
    const endpoint = `${baseUrl}/send-message`;
    const body = { device_id: deviceId, number: phone, message };
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
// AI SERVICE (OpenRouter)
// ============================================================================

async function generateAIResponse(message: string, conversationHistory: string, device: any): Promise<string> {
  try {
    const aiModel = device.api_key_option || "openai/gpt-4.1";
    const apiKey = device.api_key || "";

    if (!apiKey) {
      return "Maaf, AI belum dikonfigurasi. Silakan hubungi admin.";
    }

    const systemPrompt = `You are a helpful WhatsApp assistant. Respond naturally and concisely.

Previous Conversation:
${conversationHistory}`;

    const payload = {
      model: aiModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 500,
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://pening-bot.deno.dev",
        "X-Title": "Dev Muse Automaton",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`AI API error: ${response.status}`);

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    return content || "Maaf, saya tidak dapat memproses permintaan Anda.";
  } catch (error) {
    console.error(`❌ AI error:`, error);
    return "Maaf, saya mengalami kendala teknis. Silakan coba lagi nanti.";
  }
}

// ============================================================================
// DEBOUNCING SERVICE (4-second delay)
// ============================================================================

async function queueMessageForDebouncing(params: any): Promise<void> {
  const { deviceId, phone, message, name, provider } = params;
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
  const { deviceId, phone, name, messages } = queue;

  try {
    const combinedMessage = messages.map((m: any) => m.message).join("\n");
    console.log(`📤 [${deviceId}/${phone}] Processing: ${combinedMessage}`);

    await processAndReply(deviceId, phone, name, combinedMessage);

    const queueKey = ["message_queue", deviceId, phone];
    await kv.delete(queueKey);
    console.log(`✅ [${deviceId}/${phone}] Processing complete`);
  } catch (error) {
    console.error(`❌ [${deviceId}/${phone}] Processing error:`, error);
    const queueKey = ["message_queue", deviceId, phone];
    await kv.delete(queueKey);
  }
}

// ============================================================================
// MESSAGE PROCESSING & AI REPLY
// ============================================================================

async function processAndReply(deviceId: string, phone: string, name: string, message: string): Promise<void> {
  try {
    // Get device configuration
    const { data: device } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("id_device", deviceId)
      .single();

    if (!device) {
      console.error("Device not found:", deviceId);
      return;
    }

    // Get or create conversation
    let conversation = await getActiveConversation(deviceId, phone);

    if (!conversation) {
      conversation = await createNewConversation(device, phone, name, message);
    } else {
      await updateConversation(conversation, message);
    }

    // Generate AI response
    const conversationHistory = `User: ${conversation.conv_last || ""}\nBot: ${conversation.balas || ""}`;
    const aiResponse = await generateAIResponse(message, conversationHistory, device);

    // Send reply via WhatsApp
    await sendWhatsAppMessage(
      { deviceId: device.device_id, phone, message: aiResponse },
      device
    );

    // Save AI response to database
    await updateConversationResponse(conversation, aiResponse);

    console.log(`✅ [${deviceId}/${phone}] AI reply sent: ${aiResponse.substring(0, 50)}...`);
  } catch (error) {
    console.error("Process and reply error:", error);
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

  const conversationData = {
    id_device: device.id_device,
    prospect_num: phone,
    prospect_name: name || "Unknown",
    niche: device.niche || "",
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

  console.log(`✅ New conversation created: ${data.id_prospect}`);
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

// ============================================================================
// WEBHOOK HANDLER (GET + POST)
// ============================================================================

async function handleWebhook(req: Request, deviceId: string, webhookId: string, method: string): Promise<Response> {
  const startTime = Date.now();
  const userAgent = req.headers.get("user-agent") || "unknown";
  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  try {
    console.log(`📥 Webhook: ${method} /${deviceId}/${webhookId}`);

    // Verify device exists in database
    const { data: device, error: deviceError } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("device_id", deviceId)
      .eq("webhook_id", webhookId)
      .single();

    if (deviceError || !device) {
      console.error("❌ Device not found:", deviceError);
      return new Response(
        JSON.stringify({ success: false, error: "Device not found or invalid webhook" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Device verified: ${device.id_device} (Provider: ${device.provider})`);

    // ========== GET REQUEST (Webhook Verification) ==========
    if (method === "GET") {
      const url = new URL(req.url);
      const challenge = url.searchParams.get("hub.challenge");

      if (challenge) {
        console.log(`✅ Returning challenge for webhook verification`);
        return new Response(challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain" }
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Webhook verified",
          device_id: device.device_id,
          webhook_id: device.webhook_id,
          provider: device.provider
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== POST REQUEST (WhatsApp Messages) ==========
    if (method === "POST") {
      const rawPayload = await req.json();
      console.log(`📨 Raw payload:`, JSON.stringify(rawPayload, null, 2));

      // Parse webhook based on provider
      const parsed = await parseWebhookPayload(rawPayload, device.provider);

      if (!parsed || !parsed.message) {
        console.log(`⏭️ Skipping non-message event`);
        return new Response(
          JSON.stringify({
            success: true,
            message: "Event ignored (not a message)",
            processed: false
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { phone, message, name } = parsed;

      console.log(`✅ Message from ${phone} (${name}): ${message}`);

      // Queue message for debouncing (4-second delay)
      await queueMessageForDebouncing({
        deviceId: device.device_id,
        phone,
        message,
        name: name || "",
        provider: device.provider,
      });

      console.log(`📬 Message queued for debouncing (${config.debounceDelayMs}ms delay)`);
      console.log(`✅ Webhook processed in ${Date.now() - startTime}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Message queued for processing",
          processed: true,
          debounced: true,
          delay_ms: config.debounceDelayMs
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// MAIN SERVER
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  try {
    // Health check
    if (pathname === "/health" || pathname === "/healthz") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "dev-muse-automaton-webhook",
          debounce_delay: `${config.debounceDelayMs}ms`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Webhook pattern: /:deviceId/:webhookId
    const webhookMatch = pathname.match(/^\/([^\/]+)\/([^\/]+)$/);
    if (webhookMatch) {
      const deviceId = webhookMatch[1];
      const webhookId = webhookMatch[2];
      return await handleWebhook(req, deviceId, webhookId, method);
    }

    // 404 Not Found
    return new Response(
      JSON.stringify({ success: false, error: "Not Found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Server error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

console.log("🚀 WhatsApp Webhook Handler Started!");
console.log(`📍 Supabase: ${supabaseUrl}`);
console.log(`⏱️  Debounce: ${config.debounceDelayMs}ms`);
console.log(`💚 Health: GET /health`);
console.log(`📥 Webhook: /:deviceId/:webhookId (GET for verify, POST for messages)`);
