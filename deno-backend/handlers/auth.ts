/**
 * Authentication Handler
 *
 * Handles user registration, login, and profile management
 */

import { supabaseAdmin } from "../main.ts";
import { generateToken, getUserFromRequest } from "../utils/jwt.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * Register new user
 * POST /api/auth/register
 */
async function register(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { email, password, full_name, phone, gmail } = body;

    // Validate required fields
    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: email, password, full_name"
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from("user")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "User with this email already exists"
        }),
        { status: 409, headers: corsHeaders }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password);

    // Create user
    const { data: user, error: createError } = await supabaseAdmin
      .from("user")
      .insert({
        email,
        password: hashedPassword,
        full_name,
        phone: phone || null,
        gmail: gmail || null,
        status: "Trial",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, email, full_name, status, is_active")
      .single();

    if (createError) {
      console.error("Failed to create user:", createError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create user",
          details: createError.message
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Generate JWT token
    const token = await generateToken({
      user_id: user.id,
      email: user.email
    });

    console.log(`✅ User registered: ${user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User registered successfully",
        data: {
          user,
          token
        }
      }),
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Registration error:", error);
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
 * Login user
 * POST /api/auth/login
 */
async function login(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: email, password"
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get user by email
    const { data: user, error: userError } = await supabaseAdmin
      .from("user")
      .select("*")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid email or password"
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if user is active
    if (!user.is_active) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Account is inactive"
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid email or password"
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Update last login
    await supabaseAdmin
      .from("user")
      .update({ last_login: new Date().toISOString() })
      .eq("id", user.id);

    // Generate JWT token
    const token = await generateToken({
      user_id: user.id,
      email: user.email
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    console.log(`✅ User logged in: ${user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Login successful",
        data: {
          user: userWithoutPassword,
          token
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Login error:", error);
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
 * Get current user profile
 * GET /api/auth/me
 */
async function me(req: Request): Promise<Response> {
  try {
    // Get user from JWT token
    const currentUser = await getUserFromRequest(req);

    if (!currentUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized"
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Get full user data
    const { data: user, error: userError } = await supabaseAdmin
      .from("user")
      .select("id, email, full_name, gmail, phone, status, expired, is_active, created_at, last_login")
      .eq("id", currentUser.user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "User not found"
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { user }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("Get user error:", error);
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

export const handleAuth = {
  register,
  login,
  me
};
