/**
 * Flows Handler
 *
 * Handles chatbot flow management operations
 */

import { supabaseAdmin } from "../main.ts";
import { getUserFromRequest } from "../utils/jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * Get all flows for authenticated user
 * GET /api/flows
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

    const { data: flows, error } = await supabaseAdmin
      .from("chatbot_flows")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch flows:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to fetch flows",
          details: error.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { flows }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Get flows error:", error);
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
 * Create new flow
 * POST /api/flows
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
    const { flow_name, device_id, json_flow, is_active } = body;

    // Validate required fields
    if (!flow_name || !device_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: flow_name, device_id"
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify device belongs to user
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

    // Create flow
    const { data: flow, error: createError } = await supabaseAdmin
      .from("chatbot_flows")
      .insert({
        user_id: user.user_id,
        flow_name,
        device_id,
        json_flow: json_flow || null,
        is_active: is_active !== undefined ? is_active : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error("Failed to create flow:", createError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create flow",
          details: createError.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`✅ Flow created: ${flow.flow_name}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Flow created successfully",
        data: { flow }
      }),
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Create flow error:", error);
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
 * Get flow by ID
 * GET /api/flows/:id
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

    const { data: flow, error } = await supabaseAdmin
      .from("chatbot_flows")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.user_id)
      .single();

    if (error || !flow) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Flow not found"
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { flow }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Get flow error:", error);
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
 * Update flow
 * PUT /api/flows/:id
 */
async function update(req: Request, id: string): Promise<Response> {
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
    const { flow_name, json_flow, is_active } = body;

    // Verify flow ownership
    const { data: existingFlow } = await supabaseAdmin
      .from("chatbot_flows")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.user_id)
      .single();

    if (!existingFlow) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Flow not found"
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Update flow
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (flow_name !== undefined) updateData.flow_name = flow_name;
    if (json_flow !== undefined) updateData.json_flow = json_flow;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: flow, error: updateError } = await supabaseAdmin
      .from("chatbot_flows")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.user_id)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update flow:", updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to update flow",
          details: updateError.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`✅ Flow updated: ${flow.flow_name}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Flow updated successfully",
        data: { flow }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Update flow error:", error);
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
 * Delete flow
 * DELETE /api/flows/:id
 */
async function deleteFlow(req: Request, id: string): Promise<Response> {
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

    // Verify flow ownership
    const { data: existingFlow } = await supabaseAdmin
      .from("chatbot_flows")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.user_id)
      .single();

    if (!existingFlow) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Flow not found"
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Delete flow
    const { error: deleteError } = await supabaseAdmin
      .from("chatbot_flows")
      .delete()
      .eq("id", id)
      .eq("user_id", user.user_id);

    if (deleteError) {
      console.error("Failed to delete flow:", deleteError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to delete flow",
          details: deleteError.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`✅ Flow deleted: ${id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Flow deleted successfully"
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Delete flow error:", error);
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

export const handleFlows = {
  getAll,
  create,
  getById,
  update,
  delete: deleteFlow
};
