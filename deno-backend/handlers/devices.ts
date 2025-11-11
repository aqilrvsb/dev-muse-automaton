/**
 * Devices Handler
 *
 * Handles device management operations including CRUD and status checks
 */

import { supabaseAdmin } from "../main.ts";
import { getUserFromRequest } from "../utils/jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * Get all devices for authenticated user
 * GET /api/devices
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

    const { data: devices, error } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch devices:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to fetch devices",
          details: error.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { devices }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Get devices error:", error);
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
 * Create new device
 * POST /api/devices
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
    const { id_device, device_id, provider, api_token, status_wa } = body;

    // Validate required fields
    if (!id_device || !device_id || !provider) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: id_device, device_id, provider"
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Generate webhook_id
    const webhookId = crypto.randomUUID();

    // Create device
    const { data: device, error: createError } = await supabaseAdmin
      .from("device_setting")
      .insert({
        user_id: user.user_id,
        id_device,
        device_id,
        provider,
        api_token: api_token || null,
        webhook_id: webhookId,
        status_wa: status_wa || "disconnected",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error("Failed to create device:", createError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create device",
          details: createError.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`✅ Device created: ${device.id_device}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Device created successfully",
        data: { device }
      }),
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Create device error:", error);
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
 * Get device by ID
 * GET /api/devices/:id
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

    const { data: device, error } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("device_id", id)
      .eq("user_id", user.user_id)
      .single();

    if (error || !device) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Device not found"
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { device }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Get device error:", error);
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
 * Update device
 * PUT /api/devices/:id
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
    const { id_device, provider, api_token, status_wa } = body;

    // Verify device ownership
    const { data: existingDevice } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("device_id", id)
      .eq("user_id", user.user_id)
      .single();

    if (!existingDevice) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Device not found"
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Update device
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (id_device !== undefined) updateData.id_device = id_device;
    if (provider !== undefined) updateData.provider = provider;
    if (api_token !== undefined) updateData.api_token = api_token;
    if (status_wa !== undefined) updateData.status_wa = status_wa;

    const { data: device, error: updateError } = await supabaseAdmin
      .from("device_setting")
      .update(updateData)
      .eq("device_id", id)
      .eq("user_id", user.user_id)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update device:", updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to update device",
          details: updateError.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`✅ Device updated: ${device.id_device}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Device updated successfully",
        data: { device }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Update device error:", error);
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
 * Delete device
 * DELETE /api/devices/:id
 */
async function deleteDevice(req: Request, id: string): Promise<Response> {
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

    // Verify device ownership
    const { data: existingDevice } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("device_id", id)
      .eq("user_id", user.user_id)
      .single();

    if (!existingDevice) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Device not found"
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Delete device
    const { error: deleteError } = await supabaseAdmin
      .from("device_setting")
      .delete()
      .eq("device_id", id)
      .eq("user_id", user.user_id);

    if (deleteError) {
      console.error("Failed to delete device:", deleteError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to delete device",
          details: deleteError.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`✅ Device deleted: ${id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Device deleted successfully"
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Delete device error:", error);
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
 * Get device WhatsApp status
 * GET /api/devices/:id/status
 */
async function getStatus(req: Request, id: string): Promise<Response> {
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

    const { data: device, error } = await supabaseAdmin
      .from("device_setting")
      .select("device_id, id_device, status_wa, provider, updated_at")
      .eq("device_id", id)
      .eq("user_id", user.user_id)
      .single();

    if (error || !device) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Device not found"
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          device_id: device.device_id,
          id_device: device.id_device,
          status: device.status_wa,
          provider: device.provider,
          last_updated: device.updated_at
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Get device status error:", error);
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

export const handleDevices = {
  getAll,
  create,
  getById,
  update,
  delete: deleteDevice,
  getStatus
};
