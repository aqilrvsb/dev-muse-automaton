/**
 * AI Handler
 *
 * Handles AI chat completion endpoints
 */

import { supabaseAdmin } from "../main.ts";
import { getUserFromRequest } from "../utils/jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * AI Chat Completion
 * POST /api/ai/chat
 */
async function chat(req: Request): Promise<Response> {
  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized"
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const { message, device_id, phone, context } = body;

    // Validate required fields
    if (!message || !device_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: message, device_id"
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify device ownership
    const { data: device } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("device_id", device_id)
      .eq("user_id", user.user_id)
      .single();

    if (!device) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Device not found or unauthorized"
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get conversation history if phone is provided
    let conversationHistory = [];
    if (phone) {
      const { data: history } = await supabaseAdmin
        .from("wasapbot")
        .select("message, response, created_at")
        .eq("device_id", device_id)
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(10);

      conversationHistory = history || [];
    }

    // TODO: Integrate with actual AI service (OpenAI, Anthropic, etc.)
    // For now, return a placeholder response
    const aiResponse = {
      message: "This is a placeholder AI response. Integrate with your preferred AI service.",
      model: "placeholder",
      tokens_used: 0,
      context_used: conversationHistory.length
    };

    // Log AI interaction
    const { error: logError } = await supabaseAdmin
      .from("ai_whatsapp")
      .insert({
        device_id,
        phone: phone || "system",
        user_message: message,
        ai_response: aiResponse.message,
        context: context || null,
        created_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log AI interaction:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          response: aiResponse.message,
          metadata: {
            model: aiResponse.model,
            tokens_used: aiResponse.tokens_used,
            conversation_history_count: aiResponse.context_used
          }
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("AI chat error:", error);
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

export const handleAI = {
  chat
};
