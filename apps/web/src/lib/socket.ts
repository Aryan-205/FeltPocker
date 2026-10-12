"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServer, ServerToClient } from "@felt/engine";
import { useEffect, useSyncExternalStore } from "react";
import { useProfile } from "./store";
import { toast } from "./toast";

export type FeltSocket = Socket<ServerToClient, ClientToServer>;

export function serverUrl(): string {
  if (process.env.NEXT_PUBLIC_SERVER_URL) return process.env.NEXT_PUBLIC_SERVER_URL;
  // Same host as the page (works on LAN too), default port 4000.
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

let socket: FeltSocket | null = null;
let status: "connecting" | "ready" | "offline" = "connecting";
let playerId: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function setStatus(s: typeof status) {
  status = s;
  notify();
}

function hello(s: FeltSocket) {
  const { token, name, avatar } = useProfile.getState();
  s.emit("hello", { token, name: name || "Guest", avatar }, (r) => {
    if (r.ok) {
      playerId = r.playerId;
      setStatus("ready");
    } else {
      toast("Couldn't connect", r.error, "error");
      setStatus("offline");
    }
  });
}

export function getSocket(): FeltSocket {
  if (socket) return socket;
  const s: FeltSocket = io(serverUrl(), { transports: ["websocket"], autoConnect: false, reconnectionDelayMax: 4000 });
  socket = s;
  s.on("connect", () => hello(s));
  s.on("disconnect", () => setStatus("connecting"));
  s.on("connect_error", () => setStatus("offline"));
  s.on("bankroll:credit", ({ amount, reason }) => {
    useProfile.getState().credit(amount);
    toast(`+${amount.toLocaleString()} chips returned`, reason, "gold");
  });
  s.connect();
  return s;
}

/** Connects (once the profile is loaded) and reports connection status. */
export function useSocket() {
  const hydrated = useProfile((p) => p.hydrated);
  const named = useProfile((p) => !!p.name);
  useEffect(() => {
    if (hydrated && named) getSocket();
  }, [hydrated, named]);
  const st = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => "connecting" as const,
  );
  return { socket: hydrated && named ? socket : null, status: st, playerId };
}

/** Promise wrapper for acknowledged emits. */
export function request<R>(fn: (cb: (r: R) => void) => void, timeoutMs = 8000): Promise<R> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("The server didn't respond. Is it running?")), timeoutMs);
    fn((r) => {
      clearTimeout(t);
      resolve(r);
    });
  });
}

/** Re-identify after the player changes their name or avatar. */
export function rehello() {
  if (socket?.connected) hello(socket);
}
