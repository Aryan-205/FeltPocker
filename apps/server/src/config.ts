/** Environment configuration. See `.env.example` at the repo root. */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);

const production = process.env.NODE_ENV === "production";

export const config = {
  production,
  port: Number(process.env.PORT ?? 4000),
  /** Public URL of this server, used for the Google OAuth redirect. */
  publicUrl: (process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`).replace(/\/$/, ""),
  /** Origins of the website. Used for CORS and to validate post-login redirects. */
  webOrigins: list(process.env.WEB_ORIGINS ?? "http://localhost:3000"),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
  /** "cloudflare" trusts CF-Connecting-IP (behind a Cloudflare Tunnel), "true" trusts X-Forwarded-For. */
  trustProxy: process.env.TRUST_PROXY ?? "",
  /** Local testing only: sign in by name without Google. Ignored in production. */
  devLogin: !production && process.env.DEV_LOGIN === "1",
  maxRooms: Number(process.env.MAX_ROOMS ?? 500),
};

if (!config.google.clientId && !config.devLogin) {
  console.warn("⚠ GOOGLE_CLIENT_ID is not set, so nobody can sign in. Set it, or DEV_LOGIN=1 for local testing.");
}
