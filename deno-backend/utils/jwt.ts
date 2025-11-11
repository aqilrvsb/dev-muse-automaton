/**
 * JWT Utilities
 * Using jose library for JWT operations
 */

import * as jose from "https://deno.land/x/jose@v5.2.0/index.ts";
import { config } from "../main.ts";

const secret = new TextEncoder().encode(config.jwtSecret);

export interface JWTPayload {
  user_id: string;
  email: string;
  exp?: number;
  iat?: number;
}

/**
 * Generate JWT token
 */
export async function generateToken(payload: { user_id: string; email: string }): Promise<string> {
  const jwt = await new jose.SignJWT({
    user_id: payload.user_id,
    email: payload.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // 7 days expiration
    .sign(secret);

  return jwt;
}

/**
 * Verify JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as JWTPayload;
  } catch (error) {
    console.error("JWT verification failed:", error.message);
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;

  // Support both "Bearer token" and just "token"
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    return parts[1];
  }
  return authHeader;
}

/**
 * Get user from request (middleware-like)
 */
export async function getUserFromRequest(req: Request): Promise<JWTPayload | null> {
  const authHeader = req.headers.get("Authorization");
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return null;
  }

  return await verifyToken(token);
}
