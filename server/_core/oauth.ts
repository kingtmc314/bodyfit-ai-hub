import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { verifySupabaseToken } from "./supabase";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Decode state parameter: supports both legacy (plain base64 redirectUri)
 * and new format (base64 JSON with redirectUri + returnOrigin for cross-domain bridge)
 */
function decodeState(state: string): { redirectUri: string; returnOrigin?: string } {
  try {
    const decoded = atob(state);
    // Try to parse as JSON first (new format)
    try {
      const parsed = JSON.parse(decoded);
      if (parsed.redirectUri) return parsed;
    } catch {
      // Fall through to legacy format
    }
    // Legacy format: plain redirectUri string
    return { redirectUri: decoded };
  } catch {
    return { redirectUri: state };
  }
}

export function registerOAuthRoutes(app: Express) {
  /**
   * Supabase Auth session exchange — frontend calls this with the Supabase access token
   * after Supabase Auth completes on the client side. We verify it, upsert the user
   * by email (merging all providers), and issue our own JWT session cookie.
   */
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    const { accessToken } = req.body as { accessToken?: string };
    if (!accessToken) {
      res.status(400).json({ error: "accessToken is required" });
      return;
    }
    try {
      const supabaseUser = await verifySupabaseToken(accessToken);
      if (!supabaseUser) {
        res.status(401).json({ error: "Invalid Supabase access token" });
        return;
      }
      const email = supabaseUser.email ?? null;
      const supabaseId = supabaseUser.id;
      // Upsert user — email-based merging ensures all providers share the same row
      await db.upsertUser({
        openId: supabaseId,
        email,
        name: email?.split("@")[0] ?? null,
        loginMethod: "supabase",
        lastSignedIn: new Date(),
      });
      // Issue our own session cookie
      const sessionToken = await sdk.createSessionToken(supabaseId, {
        name: email?.split("@")[0] ?? "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ ok: true });
    } catch (error) {
      console.error("[Auth] Supabase session exchange failed", error);
      res.status(500).json({ error: "Session exchange failed" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      // Check if this is a cross-domain bridge request (e.g. Vercel → Manus domain callback)
      const { returnOrigin } = decodeState(state);
      if (returnOrigin) {
        // Redirect to the return origin with the token as a query param
        // The bridge endpoint on the return origin will set the cookie there
        const bridgeUrl = new URL("/api/oauth/bridge", returnOrigin);
        bridgeUrl.searchParams.set("token", sessionToken);
        res.redirect(302, bridgeUrl.toString());
        return;
      }

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  /**
   * Token bridge endpoint: receives a session token from cross-domain OAuth callback
   * and sets it as a cookie on the current domain, then redirects to home.
   */
  app.get("/api/oauth/bridge", async (req: Request, res: Response) => {
    const token = getQueryParam(req, "token");
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }

    // Verify the token is valid before setting cookie
    const session = await sdk.verifySession(token);
    if (!session) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.redirect(302, "/");
  });
}
