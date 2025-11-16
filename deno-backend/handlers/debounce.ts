/**
 * Debounce Handler
 *
 * Handles debounced message processing (internal endpoint)
 */

import { supabaseAdmin } from "../main.ts";
import { processMessage } from "../services/message-processor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * Process debounced messages
 * POST /api/internal/debounce/process
 *
 * This is an internal endpoint called by the debounce service
 * after the debounce delay expires.
 */
async function handleDebounceProcess(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { deviceId, webhookId, phone, message, name, provider } = body;

    console.log(`🔄 Processing debounced message from ${phone} on device ${deviceId}`);

    // Validate required fields
    if (!deviceId || !webhookId || !phone || !message) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: deviceId, webhookId, phone, message"
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify device exists
    const { data: device, error: deviceError } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("device_id", deviceId)
      .eq("webhook_id", webhookId)
      .single();

    if (deviceError || !device) {
      console.error("❌ Device not found:", deviceError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Device not found"
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if user has an active subscription
    const { data: user } = await supabaseAdmin
      .from("user")
      .select("status, expired, is_active")
      .eq("id", device.user_id)
      .single();

    if (!user || !user.is_active) {
      console.log(`⏭️  User account inactive, skipping message`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "User account inactive",
          processed: false
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Check if subscription expired
    if (user.expired && new Date(user.expired) < new Date()) {
      console.log(`⏭️  User subscription expired, skipping message`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "User subscription expired",
          processed: false
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Log incoming message to wasapbot table
    await supabaseAdmin
      .from("wasapbot")
      .insert({
        device_id: deviceId,
        phone,
        message,
        name: name || "",
        provider,
        direction: "incoming",
        created_at: new Date().toISOString()
      });

    // Process the message through the chatbot flow
    const response = await processMessage({
      deviceId,
      phone,
      message,
      name: name || "",
      userId: device.user_id
    });

    // Log AI response
    if (response) {
      await supabaseAdmin
        .from("ai_whatsapp")
        .insert({
          device_id: deviceId,
          phone,
          user_message: message,
          ai_response: response,
          created_at: new Date().toISOString()
        });

      // Log outgoing response
      await supabaseAdmin
        .from("wasapbot")
        .insert({
          device_id: deviceId,
          phone,
          message: response,
          name: device.id_device || "Bot",
          provider,
          direction: "outgoing",
          created_at: new Date().toISOString()
        });

      console.log(`✅ Message processed and response sent`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Message processed successfully",
        processed: true,
        response: response || null
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("❌ Debounce process error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to process message",
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export const handleDebounce = {
  handleDebounceProcess
};
