import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plain HTML/JS in `out/`, served by Cloudflare as static assets. Accounts, chips and
  // games all live on the game server, so the site needs no server of its own.
  output: "export",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
