/**
 * Conversations Handler
 *
 * Handles conversation/chat history management
 */

import { supabaseAdmin } from "../main.ts";
import { getUserFromRequest } from "../utils/jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * Get all conversations for authenticated user
 * GET /api/conversations
 */
async function getAll(req: Request): Promise<Response> {
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

    // Get user's devices
    const { data: devices } = await supabaseAdmin
      .from("device_setting")
      .select("device_id")
      .eq("user_id", user.user_id);

    if (!devices || devices.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: { conversations: [] }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const deviceIds = devices.map(d => d.device_id);

    // Get conversations from ai_whatsapp table
    const { data: conversations, error } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("*")
      .in("device_id", deviceIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch conversations:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to fetch conversations",
          details: error.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { conversations }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Get conversations error:", error);
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
 * Get conversation by ID
 * GET /api/conversations/:id
 */
async function getById(req: Request, id: string): Promise<Response> {
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

    // Get conversation
    const { data: conversation, error } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !conversation) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Conversation not found"
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Verify device ownership
    const { data: device } = await supabaseAdmin
      .from("device_setting")
      .select("device_id")
      .eq("device_id", conversation.device_id)
      .eq("user_id", user.user_id)
      .single();

    if (!device) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized access to conversation"
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Get related messages from wasapbot table
    const { data: messages } = await supabaseAdmin
      .from("wasapbot")
      .select("*")
      .eq("device_id", conversation.device_id)
      .eq("phone", conversation.phone)
      .order("created_at", { ascending: true });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          conversation,
          messages: messages || []
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Get conversation error:", error);
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

export const handleConversations = {
  getAll,
  getById
};
