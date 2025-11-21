/**
 * Dev Muse Automaton - Deno Deploy Backend
 *
 * Complete backend replacement for Go Fiber server
 * Handles: Authentication, Webhooks, WhatsApp, AI, Flows, Billing
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

// Import handlers
import { handleAuth } from "./handlers/auth.ts";
import { handleDevices } from "./handlers/devices.ts";
import { handleFlows } from "./handlers/flows.ts";
import { handleConversations } from "./handlers/conversations.ts";
import { handleWebhook } from "./handlers/webhook.ts";
import { handleAI } from "./handlers/ai.ts";
import { handleAnalytics } from "./handlers/analytics.ts";
import { handleOrders } from "./handlers/orders.ts";
import { handlePackages } from "./handlers/packages.ts";
import { handleStages } from "./handlers/stages.ts";
import { handleDashboard } from "./handlers/dashboard.ts";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://bjnjucwpwdzgsnqmpmff.supabase.co";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Environment config
export const config = {
  jwtSecret: Deno.env.get("JWT_SECRET") || "chatbot-automation-secret-key-change-in-production",
  billplzApiKey: Deno.env.get("BILLPLZ_API_KEY") || "",
  billplzCollectionId: Deno.env.get("BILLPLZ_COLLECTION_ID") || "",
  debounceDelayMs: parseInt(Deno.env.get("DEBOUNCE_DELAY_MS") || "4000"),
  serverUrl: Deno.env.get("SERVER_URL") || "http://localhost:8080",
};

// Main HTTP server
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204
    });
  }

  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  console.log(`${method} ${pathname}`);

  try {
    // ============ HEALTH CHECK ============
    if (pathname === "/health" || pathname === "/healthz") {
      return new Response(
        JSON.stringify({ status: "ok", service: "dev-muse-automaton-deno" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ WEBHOOK ROUTES (Public - No Auth) ============
    // Pattern: /:deviceId/:webhookId
    const webhookMatch = pathname.match(/^\/([^\/]+)\/([^\/]+)$/);
    if (webhookMatch) {
      const deviceId = webhookMatch[1];
      const webhookId = webhookMatch[2];
      return await handleWebhook(req, deviceId, webhookId, method);
    }

    // ============ API ROUTES (Authenticated) ============

    // Auth endpoints
    if (pathname === "/api/auth/login" && method === "POST") {
      return await handleAuth.login(req);
    }
    if (pathname === "/api/auth/register" && method === "POST") {
      return await handleAuth.register(req);
    }
    if (pathname === "/api/auth/me" && method === "GET") {
      return await handleAuth.me(req);
    }

    // Device endpoints
    if (pathname === "/api/devices" && method === "GET") {
      return await handleDevices.getAll(req);
    }
    if (pathname === "/api/devices" && method === "POST") {
      return await handleDevices.create(req);
    }
    if (pathname.match(/^\/api\/devices\/[^\/]+$/) && method === "GET") {
      const id = pathname.split("/").pop()!;
      return await handleDevices.getById(req, id);
    }
    if (pathname.match(/^\/api\/devices\/[^\/]+$/) && method === "PUT") {
      const id = pathname.split("/").pop()!;
      return await handleDevices.update(req, id);
    }
    if (pathname.match(/^\/api\/devices\/[^\/]+$/) && method === "DELETE") {
      const id = pathname.split("/").pop()!;
      return await handleDevices.delete(req, id);
    }
    if (pathname.match(/^\/api\/devices\/[^\/]+\/status$/) && method === "GET") {
      const id = pathname.split("/")[3];
      return await handleDevices.getStatus(req, id);
    }

    // Flow endpoints
    if (pathname === "/api/flows" && method === "GET") {
      return await handleFlows.getAll(req);
    }
    if (pathname === "/api/flows" && method === "POST") {
      return await handleFlows.create(req);
    }
    if (pathname.match(/^\/api\/flows\/[^\/]+$/) && method === "GET") {
      const id = pathname.split("/").pop()!;
      return await handleFlows.getById(req, id);
    }
    if (pathname.match(/^\/api\/flows\/[^\/]+$/) && method === "PUT") {
      const id = pathname.split("/").pop()!;
      return await handleFlows.update(req, id);
    }
    if (pathname.match(/^\/api\/flows\/[^\/]+$/) && method === "DELETE") {
      const id = pathname.split("/").pop()!;
      return await handleFlows.delete(req, id);
    }

    // Conversation endpoints
    if (pathname === "/api/conversations" && method === "GET") {
      return await handleConversations.getAll(req);
    }
    if (pathname.match(/^\/api\/conversations\/[^\/]+$/) && method === "GET") {
      const id = pathname.split("/").pop()!;
      return await handleConversations.getById(req, id);
    }

    // AI endpoints
    if (pathname === "/api/ai/chat" && method === "POST") {
      return await handleAI.chat(req);
    }

    // Analytics endpoints
    if (pathname === "/api/analytics" && method === "GET") {
      return await handleAnalytics.get(req);
    }

    // Dashboard endpoint
    if (pathname === "/api/dashboard/stats" && method === "GET") {
      return await handleDashboard.getStats(req);
    }

    // Orders endpoints
    if (pathname === "/api/orders" && method === "GET") {
      return await handleOrders.getAll(req);
    }
    if (pathname === "/api/orders" && method === "POST") {
      return await handleOrders.create(req);
    }

    // Packages endpoints
    if (pathname === "/api/packages" && method === "GET") {
      return await handlePackages.getAll(req);
    }

    // Stages endpoints
    if (pathname === "/api/stages" && method === "GET") {
      return await handleStages.getAll(req);
    }
    if (pathname === "/api/stages" && method === "POST") {
      return await handleStages.create(req);
    }

    // Debounce processing endpoint (called by debouncer or internal)
    if (pathname === "/api/debounce/process" && method === "POST") {
      const { handleDebounceProcess } = await import("./handlers/debounce.ts");
      return await handleDebounceProcess(req);
    }

    // Static file serving (frontend)
    if (!pathname.startsWith("/api/") && pathname !== "/") {
      return await serveFrontend(pathname);
    }
    if (pathname === "/") {
      return await serveFrontend("/index.html");
    }

    // 404 Not Found
    return new Response(
      JSON.stringify({ success: false, error: "Not Found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("❌ Server error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

// Serve frontend static files
async function serveFrontend(pathname: string): Promise<Response> {
  try {
    // Map paths to frontend files
    const filePath = `./frontend${pathname}`;
    const file = await Deno.readFile(filePath);

    // Determine content type
    const ext = pathname.split(".").pop() || "";
    const contentTypes: Record<string, string> = {
      "html": "text/html",
      "css": "text/css",
      "js": "application/javascript",
      "json": "application/json",
      "png": "image/png",
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "svg": "image/svg+xml",
      "ico": "image/x-icon",
    };

    const contentType = contentTypes[ext] || "application/octet-stream";

    return new Response(file, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    // If file not found, return 404
    return new Response("Not Found", { status: 404 });
  }
}

console.log("🚀 Dev Muse Automaton Deno Backend Started!");
console.log(`📍 Supabase URL: ${supabaseUrl}`);
console.log(`⏱️  Debounce delay: ${config.debounceDelayMs}ms`);
console.log(`🔗 Server URL: ${config.serverUrl}`);
console.log(`💚 Health check: GET /health`);
console.log(`📥 Webhook pattern: /:deviceId/:webhookId (GET for verification, POST for messages)`);
