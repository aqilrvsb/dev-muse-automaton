/**
 * Packages Handler
 *
 * Handles subscription package listings
 */

import { supabaseAdmin } from "../main.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * Get all available packages (public endpoint)
 * GET /api/packages
 */
async function getAll(req: Request): Promise<Response> {
  try {
    const { data: packages, error } = await supabaseAdmin
      .from("packages")
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: true });

    if (error) {
      console.error("Failed to fetch packages:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to fetch packages",
          details: error.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { packages }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Get packages error:", error);
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

export const handlePackages = {
  getAll
};
