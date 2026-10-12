"use client";

import { useSocket } from "@/lib/socket";

export function ServerStatus() {
  const { status } = useSocket();
  if (status !== "offline") return null;
  return (
    <div className="mb-6 rounded-2xl border border-ruby-400/30 bg-ruby-500/10 px-4 py-3 text-sm text-cream/80">
      <span className="font-semibold text-ruby-400">Game server unreachable.</span> Multiplayer needs the Felt server running. From the
      project root, run <code className="rounded bg-black/40 px-1.5 py-0.5 text-gold-200">pnpm dev</code>. Retrying automatically…
    </div>
  );
}
