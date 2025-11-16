/**
 * Orders Handler
 *
 * Handles billing and order management with Billplz integration
 */

import { supabaseAdmin } from "../main.ts";
import { getUserFromRequest } from "../utils/jwt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * Get all orders for authenticated user
 * GET /api/orders
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

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch orders:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to fetch orders",
          details: error.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { orders }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Get orders error:", error);
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
 * Create new order (Billplz integration)
 * POST /api/orders
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
    const { package_id, amount, description } = body;

    // Validate required fields
    if (!package_id || !amount) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: package_id, amount"
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify package exists
    const { data: pkg } = await supabaseAdmin
      .from("packages")
      .select("*")
      .eq("id", package_id)
      .single();

    if (!pkg) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Package not found"
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get user details for billing
    const { data: userData } = await supabaseAdmin
      .from("user")
      .select("email, full_name")
      .eq("id", user.user_id)
      .single();

    // Generate unique order ID
    const orderId = `ORD-${Date.now()}-${user.user_id}`;

    // TODO: Integrate with Billplz API
    // For now, create a pending order
    const billplzUrl = "https://www.billplz.com/bills/placeholder"; // Placeholder

    // Create order record
    const { data: order, error: createError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: user.user_id,
        order_id: orderId,
        package_id,
        amount,
        description: description || pkg.name,
        status: "pending",
        payment_url: billplzUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error("Failed to create order:", createError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create order",
          details: createError.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`✅ Order created: ${orderId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Order created successfully",
        data: {
          order,
          payment_url: billplzUrl,
          package: {
            name: pkg.name,
            duration: pkg.duration_days
          }
        }
      }),
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Create order error:", error);
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

export const handleOrders = {
  getAll,
  create
};
