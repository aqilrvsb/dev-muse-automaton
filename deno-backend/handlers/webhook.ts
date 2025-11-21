/**
 * Webhook Handler
 *
 * Handles WhatsApp webhooks with support for:
 * - GET requests (webhook verification from WhatsApp providers)
 * - POST requests (actual message webhooks)
 */

import { supabaseAdmin } from "../main.ts";
import { queueMessageForDebouncing } from "../services/debounce.ts";
import { parseWebhookPayload } from "../services/webhook-parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

export async function handleWebhook(
  req: Request,
  deviceId: string,
  webhookId: string,
  method: string
): Promise<Response> {
  console.log(`📥 Webhook: ${method} /${deviceId}/${webhookId}`);

  try {
    // Verify device exists
    // Note: webhookId in URL corresponds to 'instance' field in device_setting table
    const { data: device, error: deviceError } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("device_id", deviceId)
      .eq("instance", webhookId)
      .single();

    if (deviceError || !device) {
      console.error("❌ Device not found:", deviceError);
      return new Response(
        JSON.stringify({ success: false, error: "Device not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`✅ Device found: ${device.device_id} (Provider: ${device.provider})`);

    // ========== GET REQUEST (Webhook Verification) ==========
    if (method === "GET") {
      return handleWebhookVerification(req, device);
    }

    // ========== POST REQUEST (Actual Messages) ==========
    if (method === "POST") {
      return await handleWebhookMessage(req, device);
    }

    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error.message
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Handle GET request (Webhook verification)
 *
 * WhatsApp providers typically send verification challenges like:
 * GET /:deviceId/:webhookId?hub.verify_token=xxx&hub.challenge=yyy
 *
 * We need to return the challenge to verify the webhook URL.
 */
function handleWebhookVerification(req: Request, device: any): Response {
  const url = new URL(req.url);

  // Get query parameters
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const mode = url.searchParams.get("hub.mode");

  console.log(`🔍 Webhook verification request:`, {
    mode,
    verifyToken: verifyToken ? "***" : null,
    challenge: challenge ? "received" : null,
  });

  // If challenge is provided, return it (WhatsApp-style verification)
  if (challenge) {
    console.log(`✅ Returning challenge for webhook verification`);
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });
  }

  // Generic verification response
  console.log(`✅ Webhook verification successful`);
  return new Response(
    JSON.stringify({
      success: true,
      message: "Webhook verified",
      device_id: device.device_id,
      instance: device.instance,
      provider: device.provider
    }),
    { status: 200, headers: corsHeaders }
  );
}

/**
 * Handle POST request (Actual webhook messages)
 */
async function handleWebhookMessage(req: Request, device: any): Promise<Response> {
  try {
    // Parse webhook payload
    const rawPayload = await req.json();
    console.log(`📨 Raw webhook payload:`, JSON.stringify(rawPayload, null, 2));

    // Parse based on provider type
    const parsed = await parseWebhookPayload(rawPayload, device.provider);

    if (!parsed) {
      console.log(`⏭️  Skipping non-message webhook event`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Event ignored (not a message)",
          processed: false
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const { phone, message, name } = parsed;

    if (!message || message.trim() === "") {
      console.log(`⏭️  Skipping empty message`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Empty message ignored",
          processed: false
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`✅ Parsed message from ${phone} (${name || 'Unknown'}): ${message}`);

    // Queue message for debouncing
    await queueMessageForDebouncing({
      deviceId: device.device_id,
      webhookId: device.instance, // instance field is used as webhookId
      phone,
      message,
      name: name || "",
      provider: device.provider,
    });

    console.log(`📬 Message queued for debouncing (4s delay)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Message queued for processing",
        processed: true,
        debounced: true
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("❌ Failed to process webhook message:", error);
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
