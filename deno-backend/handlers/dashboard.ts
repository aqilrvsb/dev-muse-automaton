/**
 * Dashboard Handler
 *
 * Handles dashboard statistics and overview data
 */

import { supabaseAdmin } from "../main.ts";
import { getUserFromRequest } from "../utils/jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * Get dashboard statistics for authenticated user
 * GET /api/dashboard/stats
 */
async function getStats(req: Request): Promise<Response> {
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

    // Get user details
    const { data: userData } = await supabaseAdmin
      .from("user")
      .select("full_name, email, status, expired, created_at")
      .eq("id", user.user_id)
      .single();

    // Get total devices
    const { data: devices, count: totalDevices } = await supabaseAdmin
      .from("device_setting")
      .select("device_id, id_device, status_wa, provider", { count: "exact" })
      .eq("user_id", user.user_id);

    const deviceIds = devices?.map(d => d.device_id) || [];

    // Get connected devices count
    const connectedDevices = devices?.filter(d => d.status_wa === "connected").length || 0;

    // Get total flows
    const { count: totalFlows } = await supabaseAdmin
      .from("chatbot_flows")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.user_id);

    // Get active flows
    const { count: activeFlows } = await supabaseAdmin
      .from("chatbot_flows")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.user_id)
      .eq("is_active", true);

    // Get total conversations (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: totalConversations } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("*", { count: "exact", head: true })
      .in("device_id", deviceIds)
      .gte("created_at", thirtyDaysAgo);

    // Get total messages (last 30 days)
    const { count: totalMessages } = await supabaseAdmin
      .from("wasapbot")
      .select("*", { count: "exact", head: true })
      .in("device_id", deviceIds)
      .gte("created_at", thirtyDaysAgo);

    // Get recent conversations
    const { data: recentConversations } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("id, phone, user_message, ai_response, created_at, device_id")
      .in("device_id", deviceIds)
      .order("created_at", { ascending: false })
      .limit(5);

    // Get today's activity
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayConversations } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("*", { count: "exact", head: true })
      .in("device_id", deviceIds)
      .gte("created_at", todayStart.toISOString());

    const { count: todayMessages } = await supabaseAdmin
      .from("wasapbot")
      .select("*", { count: "exact", head: true })
      .in("device_id", deviceIds)
      .gte("created_at", todayStart.toISOString());

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user: {
            name: userData?.full_name,
            email: userData?.email,
            status: userData?.status,
            expired: userData?.expired,
            member_since: userData?.created_at
          },
          overview: {
            total_devices: totalDevices || 0,
            connected_devices: connectedDevices,
            total_flows: totalFlows || 0,
            active_flows: activeFlows || 0,
            total_conversations_30d: totalConversations || 0,
            total_messages_30d: totalMessages || 0,
            today_conversations: todayConversations || 0,
            today_messages: todayMessages || 0
          },
          devices: devices || [],
          recent_conversations: recentConversations || []
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Get dashboard stats error:", error);
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

export const handleDashboard = {
  getStats
};
