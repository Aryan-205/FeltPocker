"use client";

import { useSocket } from "@/lib/socket";

export function ServerStatus() {
  const { status } = useSocket();
  if (status !== "offline") return null;
  return (
    <div className="mb-6 rounded-2xl border border-ruby-400/30 bg-ruby-500/10 px-4 py-3 text-sm text-cream/80">
      <span className="font-semibold text-ruby-400">Can&apos;t reach the game server.</span> It may be restarting for an update.
      Retrying automatically…
    </div>
  );
}
