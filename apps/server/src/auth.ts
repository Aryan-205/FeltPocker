import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { upsertUser } from "./accounts";
import { config } from "./config";
import { allow, clientIp, createSession, destroySession, putOnce, randomToken, takeOnce } from "./redis";

/**
 * Google sign-in (OAuth 2 authorization code + PKCE), handled entirely by the game server.
 *
 *   web → GET /auth/google?return=<web url>  → Google → GET /auth/google/callback
 *       → redirect to <web url>#session=<token>
 *
 * The website stores the token and sends it when opening the socket. Tokens travel in
 * the URL fragment, which browsers never send to servers or put in Referer headers.
 */

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const callbackUrl = () => `${config.publicUrl}/auth/google/callback`;

/** Only redirect back to our own website. */
function safeReturn(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return config.webOrigins.includes(u.origin) ? u.toString() : null;
  } catch {
    return null;
  }
}

const withFragment = (url: string, params: Record<string, string>) => `${url.split("#")[0]}#${new URLSearchParams(params)}`;

function redirect(res: ServerResponse, to: string) {
  res.writeHead(302, { location: to, "cache-control": "no-store" }).end();
}

function text(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" }).end(body);
}

/** CORS for the few JSON endpoints the website calls directly. */
function cors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (origin && config.webOrigins.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
    res.setHeader("access-control-allow-headers", "authorization");
    res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return true;
  }
  return false;
}

interface Pending {
  verifier: string;
  returnTo: string;
}

/** Decode a JWT payload. Safe without signature checks only because it came straight from Google over TLS. */
function jwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1];
  if (!part) throw new Error("Malformed ID token");
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

async function finishLogin(res: ServerResponse, returnTo: string, sub: string, email: string | null) {
  const account = await upsertUser(sub, email);
  if (account.banned) return redirect(res, withFragment(returnTo, { error: "This account is suspended." }));
  const session = await createSession(account.id);
  redirect(res, withFragment(returnTo, { session }));
}

/** Returns true if the request was an auth route. */
export async function handleAuth(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://x");
  if (!url.pathname.startsWith("/auth/")) return false;
  const ip = clientIp(req);

  try {
    if (url.pathname === "/auth/google" && req.method === "GET") {
      const returnTo = safeReturn(url.searchParams.get("return"));
      if (!returnTo) return text(res, 400, "Invalid return URL"), true;
      if (!config.google.clientId) return redirect(res, withFragment(returnTo, { error: "Google sign-in isn't configured on the server." })), true;
      if (!(await allow(`auth:${ip}`, 20, 600))) return redirect(res, withFragment(returnTo, { error: "Too many sign-in attempts. Try again in a few minutes." })), true;

      const state = randomToken(24);
      const verifier = randomToken(48);
      await putOnce(`oauth:${state}`, { verifier, returnTo } satisfies Pending, 600);
      const q = new URLSearchParams({
        client_id: config.google.clientId,
        redirect_uri: callbackUrl(),
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: createHash("sha256").update(verifier).digest("base64url"),
        code_challenge_method: "S256",
        prompt: "select_account",
      });
      redirect(res, `${GOOGLE_AUTH}?${q}`);
      return true;
    }

    if (url.pathname === "/auth/google/callback" && req.method === "GET") {
      const state = url.searchParams.get("state") ?? "";
      const pending = state ? await takeOnce<Pending>(`oauth:${state}`) : null;
      if (!pending) return text(res, 400, "This sign-in link expired. Go back and try again."), true;
      const code = url.searchParams.get("code");
      if (!code) return redirect(res, withFragment(pending.returnTo, { error: "Sign-in was cancelled." })), true;

      const tokenRes = await fetch(GOOGLE_TOKEN, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: config.google.clientId,
          client_secret: config.google.clientSecret,
          redirect_uri: callbackUrl(),
          grant_type: "authorization_code",
          code_verifier: pending.verifier,
        }),
      });
      const body = (await tokenRes.json()) as { id_token?: string; error?: string };
      if (!tokenRes.ok || !body.id_token) throw new Error(`Google token exchange failed: ${body.error ?? tokenRes.status}`);
      const claims = jwtPayload(body.id_token);
      const validIssuer = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
      if (!validIssuer || claims.aud !== config.google.clientId || typeof claims.sub !== "string" || Number(claims.exp) * 1000 < Date.now()) {
        throw new Error("Google returned an invalid ID token");
      }
      const email = claims.email_verified && typeof claims.email === "string" ? claims.email : null;
      await finishLogin(res, pending.returnTo, `google:${claims.sub}`, email);
      return true;
    }

    // Local testing only: /auth/dev?name=alice&return=http://localhost:3000/auth/done
    if (url.pathname === "/auth/dev" && req.method === "GET" && config.devLogin) {
      const returnTo = safeReturn(url.searchParams.get("return"));
      const name = (url.searchParams.get("name") ?? "").trim().toLowerCase().slice(0, 20);
      if (!returnTo || !name) return text(res, 400, "Need ?name= and a valid ?return="), true;
      await finishLogin(res, returnTo, `dev:${name}`, null);
      return true;
    }

    if (url.pathname === "/auth/logout") {
      if (cors(req, res)) return true;
      if (req.method !== "POST") return text(res, 405, "Method not allowed"), true;
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (token) await destroySession(token);
      res.writeHead(204).end();
      return true;
    }

    text(res, 404, "Not found");
    return true;
  } catch (e) {
    console.error("auth error:", e);
    if (!res.headersSent) text(res, 500, "Sign-in failed. Please try again.");
    return true;
  }
}
