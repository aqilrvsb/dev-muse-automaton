import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHACENTER_API_URL = Deno.env.get("WHACENTER_API_URL") || "https://api.whacenter.com";

// Initialize Supabase admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-wc-webhook-signature, x-wc-webhook-source, x-wc-webhook-topic",
};

// WooCommerce Order interface
interface WooOrder {
  id: number;
  status: string;
  currency: string;
  total: string;
  billing: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    phone: string;
    email: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    phone: string;
  };
  payment_method: string;
  payment_method_title: string;
  line_items: Array<{
    name: string;
    quantity: number;
    total: string;
    sku: string;
  }>;
  date_created: string;
}

// Format phone number to Malaysian format
function formatPhoneNumber(phone: string): string {
  if (!phone) return "";

  let formatted = phone.replace(/\D/g, '');

  // If starts with 0, replace with 60
  if (formatted.startsWith('0')) {
    formatted = '60' + formatted.substring(1);
  }
  // If doesn't start with 60, add 60
  if (!formatted.startsWith('60')) {
    formatted = '60' + formatted;
  }

  return formatted;
}

// Replace template variables with order data
function replaceTemplateVariables(template: string, orderData: {
  name: string;
  phone: string;
  order_id: string;
  product: string;
  total: string;
  status: string;
  address: string;
}): string {
  return template
    .replace(/\{\{name\}\}/g, orderData.name)
    .replace(/\{\{phone\}\}/g, orderData.phone)
    .replace(/\{\{order_id\}\}/g, orderData.order_id)
    .replace(/\{\{product\}\}/g, orderData.product)
    .replace(/\{\{total\}\}/g, orderData.total)
    .replace(/\{\{status\}\}/g, orderData.status)
    .replace(/\{\{address\}\}/g, orderData.address);
}

// Send WhatsApp message via WhatsApp Center
async function sendWhatsAppMessage(deviceInstance: string, phone: string, message: string): Promise<boolean> {
  try {
    const url = `${WHACENTER_API_URL}/api/send`;

    const formData = new URLSearchParams();
    formData.append('device_id', deviceInstance);
    formData.append('number', phone);
    formData.append('message', message);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.error(`WhatsApp Center API error: ${response.statusText}`);
      return false;
    }

    console.log(`✅ WhatsApp message sent to ${phone}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to send WhatsApp message:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get device instance from URL path
  // URL format: https://pening-bot-website.deno.dev/{instance}
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const deviceInstance = pathParts[0];

  if (!deviceInstance) {
    return new Response(
      JSON.stringify({ error: "Device instance ID is required in URL path" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`\n=== WooCommerce Webhook Received ===`);
  console.log(`Device Instance: ${deviceInstance}`);

  try {
    // Get raw body
    const rawBody = await req.text();

    // Handle empty body (ping test from WooCommerce)
    if (!rawBody || rawBody.trim() === '') {
      console.log("WooCommerce ping test received");
      return new Response(
        JSON.stringify({ success: true, message: "Webhook endpoint is active" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let wooOrder: WooOrder;
    try {
      wooOrder = JSON.parse(rawBody);
    } catch {
      console.log("Non-JSON body received, treating as ping test");
      return new Response(
        JSON.stringify({ success: true, message: "Webhook endpoint is active" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle webhook ping/test
    const orderAsAny = wooOrder as any;
    const isPingTest = wooOrder && typeof wooOrder === 'object' && (
      'webhook_id' in wooOrder ||
      orderAsAny.action === 'woocommerce_rest_api_test_connection' ||
      !wooOrder.id ||
      !wooOrder.status
    );

    if (isPingTest) {
      console.log("WooCommerce webhook ping/test received");
      return new Response(
        JSON.stringify({ success: true, message: "Webhook test successful" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Order ID: ${wooOrder.id}`);
    console.log(`Order Status: ${wooOrder.status}`);

    // Step 1: Get device settings by instance
    const { data: deviceSettings, error: deviceError } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("instance", deviceInstance)
      .single();

    if (deviceError || !deviceSettings) {
      console.error(`Device not found for instance: ${deviceInstance}`);
      return new Response(
        JSON.stringify({ error: "Device not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Check if webhook is enabled for this device
    if (!deviceSettings.ecom_webhook_enabled) {
      console.log(`Webhook disabled for device ${deviceSettings.device_id}`);
      return new Response(
        JSON.stringify({ success: true, message: "Webhook disabled for this device" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Device: ${deviceSettings.device_id}`);
    console.log(`User ID: ${deviceSettings.user_id}`);
    console.log(`Webhook Stage: ${deviceSettings.ecom_webhook_stage}`);

    // Only process orders with status 'processing' (payment confirmed)
    if (wooOrder.status !== 'processing') {
      console.log(`Skipping order - status is not processing: ${wooOrder.status}`);
      return new Response(
        JSON.stringify({ success: true, message: `Skipped - order status is ${wooOrder.status}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Extract customer data
    const shipping = wooOrder.shipping.address_1 ? wooOrder.shipping : wooOrder.billing;
    const customerName = `${shipping.first_name} ${shipping.last_name}`.trim() ||
                        `${wooOrder.billing.first_name} ${wooOrder.billing.last_name}`.trim();
    const customerPhone = formatPhoneNumber(shipping.phone || wooOrder.billing.phone);
    const fullAddress = [shipping.address_1, shipping.address_2, shipping.city, shipping.state, shipping.postcode]
      .filter(Boolean).join(', ');
    const productNames = wooOrder.line_items.map(item => `${item.name} x${item.quantity}`).join(', ');
    const totalPrice = wooOrder.total;

    console.log(`Customer: ${customerName}`);
    console.log(`Phone: ${customerPhone}`);
    console.log(`Products: ${productNames}`);
    console.log(`Total: ${wooOrder.currency} ${totalPrice}`);

    if (!customerPhone) {
      console.error("No phone number found in order");
      return new Response(
        JSON.stringify({ error: "No phone number in order" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Check if lead already exists
    const { data: existingLead } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("*")
      .eq("prospect_num", customerPhone)
      .eq("device_id", deviceSettings.device_id)
      .single();

    let leadId: string;

    // Build detail string from WooCommerce order data
    const orderDetails = `NAMA: ${customerName}
NO FONE: ${customerPhone}
ALAMAT: ${fullAddress}
PRODUK: ${productNames}
HARGA: RM${totalPrice}
ORDER ID: ${wooOrder.id}
STATUS: ${wooOrder.status}`;

    if (existingLead) {
      // Update existing lead
      console.log(`Existing lead found: ${existingLead.id_prospect}`);
      leadId = existingLead.id_prospect;

      const { error: updateError } = await supabaseAdmin
        .from("ai_whatsapp")
        .update({
          prospect_name: customerName,
          stage: (deviceSettings.ecom_webhook_stage || 'NEW').toUpperCase(),
          detail: orderDetails,  // ✅ Save order details
          last_message_at: new Date().toISOString(),
        })
        .eq("id_prospect", leadId);

      if (updateError) {
        console.error("Error updating lead:", updateError);
      } else {
        console.log(`✅ Lead updated with stage: ${deviceSettings.ecom_webhook_stage}`);
      }
    } else {
      // Create new lead
      const { data: newLead, error: createError } = await supabaseAdmin
        .from("ai_whatsapp")
        .insert({
          user_id: deviceSettings.user_id,
          device_id: deviceSettings.device_id,
          prospect_name: customerName,
          prospect_num: customerPhone,
          stage: (deviceSettings.ecom_webhook_stage || 'NEW').toUpperCase(),
          detail: orderDetails,  // ✅ Save order details
          ai_enabled: true,
          messages: [],
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating lead:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create lead" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      leadId = newLead.id_prospect;
      console.log(`✅ New lead created: ${leadId}`);
    }

    // Step 5: Send WhatsApp message if template exists
    const template = deviceSettings.ecom_webhook_template;

    if (template) {
      const orderData = {
        name: customerName,
        phone: customerPhone,
        order_id: wooOrder.id.toString(),
        product: productNames,
        total: totalPrice,
        status: wooOrder.status,
        address: fullAddress,
      };

      const message = replaceTemplateVariables(template, orderData);
      console.log(`📤 Sending message to ${customerPhone}...`);

      const sent = await sendWhatsAppMessage(deviceInstance, customerPhone, message);

      if (sent) {
        // Save message to conversation history
        const messageEntry = {
          role: "assistant",
          content: message,
          timestamp: new Date().toISOString(),
          source: "woocommerce_webhook",
        };

        const { data: currentLead } = await supabaseAdmin
          .from("ai_whatsapp")
          .select("messages")
          .eq("id_prospect", leadId)
          .single();

        const currentMessages = currentLead?.messages || [];
        currentMessages.push(messageEntry);

        await supabaseAdmin
          .from("ai_whatsapp")
          .update({
            messages: currentMessages,
            last_ai_response: message,
          })
          .eq("id_prospect", leadId);

        console.log(`✅ Message saved to conversation history`);
      }
    } else {
      console.log(`ℹ️ No message template configured, skipping WhatsApp message`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Order processed successfully",
        lead_id: leadId,
        order_id: wooOrder.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("WooCommerce webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

console.log(`🚀 WooCommerce Webhook Handler Started!`);
console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
console.log(`📱 WhatsApp Provider: WhatsApp Center`);
console.log(`🔗 WhatsApp Center API: ${WHACENTER_API_URL}`);
