/**
 * Analytics Handler
 *
 * Handles analytics and reporting data
 */

import { supabaseAdmin } from "../main.ts";
import { getUserFromRequest } from "../utils/jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * Get analytics data for authenticated user
 * GET /api/analytics
 */
async function get(req: Request): Promise<Response> {
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

    // Parse query parameters for date range
    const url = new URL(req.url);
    const startDate = url.searchParams.get("start_date") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // Default: 30 days ago
    const endDate = url.searchParams.get("end_date") || new Date().toISOString();

    // Get user's devices
    const { data: devices } = await supabaseAdmin
      .from("device_setting")
      .select("device_id, id_device")
      .eq("user_id", user.user_id);

    if (!devices || devices.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            total_devices: 0,
            total_conversations: 0,
            total_messages: 0,
            active_flows: 0,
            devices: [],
            date_range: { start: startDate, end: endDate }
          }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const deviceIds = devices.map(d => d.device_id);

    // Get total conversations
    const { count: totalConversations } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("*", { count: "exact", head: true })
      .in("device_id", deviceIds)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    // Get total messages
    const { count: totalMessages } = await supabaseAdmin
      .from("wasapbot")
      .select("*", { count: "exact", head: true })
      .in("device_id", deviceIds)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    // Get active flows
    const { count: activeFlows } = await supabaseAdmin
      .from("chatbot_flows")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.user_id)
      .eq("is_active", true);

    // Get per-device analytics
    const deviceAnalytics = await Promise.all(
      devices.map(async (device) => {
        const { count: deviceConversations } = await supabaseAdmin
          .from("ai_whatsapp")
          .select("*", { count: "exact", head: true })
          .eq("device_id", device.device_id)
          .gte("created_at", startDate)
          .lte("created_at", endDate);

        const { count: deviceMessages } = await supabaseAdmin
          .from("wasapbot")
          .select("*", { count: "exact", head: true })
          .eq("device_id", device.device_id)
          .gte("created_at", startDate)
          .lte("created_at", endDate);

        return {
          device_id: device.device_id,
          device_name: device.id_device,
          conversations: deviceConversations || 0,
          messages: deviceMessages || 0
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          total_devices: devices.length,
          total_conversations: totalConversations || 0,
          total_messages: totalMessages || 0,
          active_flows: activeFlows || 0,
          devices: deviceAnalytics,
          date_range: {
            start: startDate,
            end: endDate
          }
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Get analytics error:", error);
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

export const handleAnalytics = {
  get
};
