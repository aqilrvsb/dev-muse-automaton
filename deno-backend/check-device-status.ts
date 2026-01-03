import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHACENTER_API_URL = Deno.env.get("WHACENTER_API_URL") || "https://api.whacenter.com";
const WHACENTER_API_KEY = Deno.env.get("WHACENTER_API_KEY") || "d44ac50f-0bd8-4ed0-b85f-55465e08d7cf";

// Initialize Supabase admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ============================================================================
// DEVICE STATUS CHECK - Send notifications for offline devices
// ============================================================================

async function checkDeviceStatusAndNotify(): Promise<{ success: boolean; message: string; details?: any }> {
  console.log("\n🔍 === DEVICE STATUS CHECK START ===");

  try {
    // Step 1: Get admin device for sending notifications
    const { data: adminDevice, error: adminError } = await supabaseAdmin
      .from("admin_device")
      .select("*")
      .single();

    if (adminError || !adminDevice) {
      console.log("⚠️  No admin device configured, skipping device status check");
      return { success: false, message: "No admin device configured" };
    }

    // Check if admin device is connected
    const adminStatusResponse = await fetch(
      `${WHACENTER_API_URL}/api/${WHACENTER_API_KEY}/statusDevice/${adminDevice.instance}`,
      { method: 'GET' }
    );
    const adminStatusData = await adminStatusResponse.json();

    if (!adminStatusData.status || adminStatusData.data?.status !== 'CONNECTED') {
      console.log("⚠️  Admin device is not connected, skipping notifications");
      return { success: false, message: "Admin device is not connected" };
    }

    console.log("✅ Admin device is connected, proceeding with status checks");

    // Step 2: Get all users who:
    // - Are NOT trial (status != 'Trial')
    // - Have phone number filled (starts with 6)
    // - Are active
    const { data: eligibleUsers, error: usersError } = await supabaseAdmin
      .from("user")
      .select("id, full_name, phone, subscription_end, role")
      .neq("status", "Trial")
      .eq("is_active", true)
      .not("phone", "is", null);

    if (usersError) {
      console.error("❌ Error fetching users:", usersError);
      return { success: false, message: "Error fetching users" };
    }

    if (!eligibleUsers || eligibleUsers.length === 0) {
      console.log("ℹ️  No eligible users found for device status check");
      return { success: true, message: "No eligible users found" };
    }

    console.log(`📋 Found ${eligibleUsers.length} eligible users to check`);

    // Filter users with valid phone numbers and not expired
    const now = new Date();
    const validUsers = eligibleUsers.filter((user: { id: string; full_name: string; phone: string; subscription_end: string | null; role: string }) => {
      // Skip admins
      if (user.role === 'admin') return false;

      // Check phone starts with 6
      if (!user.phone || !user.phone.startsWith('6')) return false;

      // Check subscription not expired
      if (user.subscription_end) {
        const endDate = new Date(user.subscription_end);
        if (now > endDate) return false;
      }

      return true;
    });

    console.log(`📋 ${validUsers.length} users have valid phone and active subscription`);

    let offlineCount = 0;
    let notificationsSent = 0;

    // Step 3: For each valid user, check their devices
    for (const user of validUsers) {
      // Get devices for this user
      const { data: devices, error: devicesError } = await supabaseAdmin
        .from("device_setting")
        .select("id, device_id, instance, status")
        .eq("user_id", user.id);

      if (devicesError || !devices || devices.length === 0) {
        continue;
      }

      // Check each device status
      for (const device of devices) {
        if (!device.instance) continue;

        try {
          // Check device status with WhatsApp Center API
          const statusResponse = await fetch(
            `${WHACENTER_API_URL}/api/${WHACENTER_API_KEY}/statusDevice/${device.instance}`,
            { method: 'GET' }
          );
          const statusData = await statusResponse.json();

          const isConnected = statusData.status && statusData.data?.status === 'CONNECTED';
          const newStatus = isConnected ? 'CONNECTED' : 'NOT_CONNECTED';

          // Update status in database
          await supabaseAdmin
            .from("device_setting")
            .update({ status: newStatus })
            .eq("id", device.id);

          // If device is offline, send notification
          if (!isConnected) {
            offlineCount++;
            console.log(`📱 Device ${device.device_id} is OFFLINE for user ${user.full_name}`);

            // Get Malaysia time (UTC+8)
            const malaysiaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
            const dateStr = malaysiaTime.toISOString().split('T')[0];
            const timeStr = malaysiaTime.toISOString().split('T')[1].substring(0, 5);

            // Format notification message
            const notificationMessage = `*Notification PeningBot*

Status Device : Offline ❌
Name Device : ${device.device_id}
Date : ${dateStr}
Time : ${timeStr}

Sila scan semula QR code di Device Settings.`;

            // Send notification via admin device
            const sendUrl = `${WHACENTER_API_URL}/api/send`;
            const formData = new URLSearchParams();
            formData.append('device_id', adminDevice.instance);
            formData.append('number', user.phone);
            formData.append('message', notificationMessage);

            const sendResponse = await fetch(sendUrl, {
              method: 'POST',
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: formData.toString(),
            });

            if (sendResponse.ok) {
              notificationsSent++;
              console.log(`✅ Sent offline notification to ${user.phone} for device ${device.device_id}`);
            } else {
              console.error(`❌ Failed to send notification: ${await sendResponse.text()}`);
            }
          }
        } catch (deviceError) {
          console.error(`❌ Error checking device ${device.device_id}:`, deviceError);
        }
      }
    }

    console.log("✅ === DEVICE STATUS CHECK COMPLETE ===\n");

    return {
      success: true,
      message: "Device status check completed",
      details: {
        usersChecked: validUsers.length,
        offlineDevices: offlineCount,
        notificationsSent: notificationsSent
      }
    };
  } catch (error) {
    console.error("❌ Device status check error:", error);
    return { success: false, message: String(error) };
  }
}

// ============================================================================
// MAIN SERVER
// ============================================================================

serve(async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  console.log(`${method} ${path}`);

  try {
    // Health check
    if (path === "/health" || path === "/") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "pening-bot-check-device",
          description: "Device status check service for PeningBot"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Device status check endpoint
    if (path === "/check" || path === "/api/check-device-status") {
      console.log("🔔 Device status check triggered");
      const result = await checkDeviceStatusAndNotify();
      return new Response(
        JSON.stringify(result),
        { status: result.success ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({ success: false, error: "Not found. Use /check or /health" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Server error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

console.log("🚀 PeningBot Device Check Service Started!");
console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
console.log(`🔗 WhatsApp Center API: ${WHACENTER_API_URL}`);
console.log("📋 Endpoints:");
console.log("   GET /health - Health check");
console.log("   GET /check - Run device status check");
console.log("   GET /api/check-device-status - Run device status check (alias)");
