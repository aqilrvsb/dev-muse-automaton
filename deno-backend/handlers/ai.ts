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
 * AI Chat Completion with Dynamic Prompt Support
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

    // Get prompt data for this device
    const { data: prompt } = await supabaseAdmin
      .from("prompts")
      .select("prompts_data, niche")
      .eq("device_id", device_id)
      .single();

    if (!prompt || !prompt.prompts_data) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No prompt configured for this device. Please set up a prompt first."
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get conversation history and current stage
    let conversationHistoryText = "";
    let currentStage: string | null = null;

    if (phone) {
      const { data: aiHistory } = await supabaseAdmin
        .from("ai_whatsapp")
        .select("prospect_num, conv_last, stage, date_insert")
        .eq("device_id", device_id)
        .eq("prospect_num", phone)
        .order("date_insert", { ascending: false })
        .limit(10);

      if (aiHistory && aiHistory.length > 0) {
        // Get current stage from most recent conversation
        currentStage = aiHistory[0].stage || null;

        // Build conversation history text
        conversationHistoryText = aiHistory
          .reverse()
          .map(h => `[${h.date_insert}] Customer: ${h.conv_last}`)
          .join("\n");
      }
    }

    console.log(`💬 Processing message from ${phone || 'unknown'}`);
    console.log(`📋 Current Stage: ${currentStage || 'First Stage'}`);

    // Import AI service functions
    const { generateFlowAIResponse } = await import("../services/ai.ts");

    // Generate AI response with dynamic prompt
    const aiResponse = await generateFlowAIResponse(
      conversationHistoryText,
      message,
      prompt.prompts_data,
      device,
      currentStage,
      false // useOneMessage - can be made configurable
    );

    // Log AI interaction with stage and details
    const { error: logError } = await supabaseAdmin
      .from("ai_whatsapp")
      .insert({
        device_id,
        prospect_num: phone || "system",
        prospect_name: context?.name || phone || "Unknown",
        niche: prompt.niche || "General",
        stage: aiResponse.stage,
        conv_last: message,
        detail: aiResponse.details,
        human: 0, // AI response
        date_insert: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log AI interaction:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          response: aiResponse.cleanContent,
          stage: aiResponse.stage,
          has_details: aiResponse.hasDetails,
          metadata: {
            stage_detected: aiResponse.hasStageMarker,
            details_captured: aiResponse.hasDetails,
            current_stage: aiResponse.stage
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
