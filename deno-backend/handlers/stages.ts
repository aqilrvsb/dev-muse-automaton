/**
 * Stages Handler
 *
 * Handles stage management for chatbot flows
 */

import { supabaseAdmin } from "../main.ts";
import { getUserFromRequest } from "../utils/jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * Get all stages for a device
 * GET /api/stages?device_id=xxx
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

    const url = new URL(req.url);
    const deviceId = url.searchParams.get("device_id");

    if (!deviceId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required parameter: device_id"
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify device ownership
    const { data: device } = await supabaseAdmin
      .from("device_setting")
      .select("device_id")
      .eq("device_id", deviceId)
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

    // Get stages for device
    const { data: stages, error } = await supabaseAdmin
      .from("stagesetvalue")
      .select("*")
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch stages:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to fetch stages",
          details: error.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { stages }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Get stages error:", error);
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
 * Create new stage
 * POST /api/stages
 */
async function create(req: Request): Promise<Response> {
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
    const { device_id, phone, stage_name, stage_value } = body;

    // Validate required fields
    if (!device_id || !phone || !stage_name) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: device_id, phone, stage_name"
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify device ownership
    const { data: device } = await supabaseAdmin
      .from("device_setting")
      .select("device_id")
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

    // Create or update stage
    const { data: stage, error: upsertError } = await supabaseAdmin
      .from("stagesetvalue")
      .upsert({
        device_id,
        phone,
        stage_name,
        stage_value: stage_value || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "device_id,phone,stage_name"
      })
      .select()
      .single();

    if (upsertError) {
      console.error("Failed to create stage:", upsertError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create stage",
          details: upsertError.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`✅ Stage created/updated: ${stage_name} for ${phone}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Stage created successfully",
        data: { stage }
      }),
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Create stage error:", error);
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

export const handleStages = {
  getAll,
  create
};
