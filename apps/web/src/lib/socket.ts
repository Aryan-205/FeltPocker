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

type Status = "signed-out" | "connecting" | "ready" | "offline";

let socket: FeltSocket | null = null;
let status: Status = "connecting";
let playerId: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function setStatus(s: Status) {
  status = s;
  notify();
}

function hello(s: FeltSocket) {
  const { name, avatar } = useProfile.getState();
  s.emit("hello", { name, avatar }, (r) => {
    if (r.ok) {
      playerId = r.playerId;
      useProfile.getState().setAccount(r.account);
      setStatus("ready");
    } else {
      toast("Couldn't connect", r.error, "error");
      setStatus("offline");
    }
  });
}

function connect(session: string): FeltSocket {
  if (socket) return socket;
  const s: FeltSocket = io(serverUrl(), {
    transports: ["websocket"],
    autoConnect: false,
    reconnectionDelayMax: 4000,
    auth: { session },
  });
  socket = s;
  setStatus("connecting");
  s.on("connect", () => hello(s));
  s.on("disconnect", () => setStatus("connecting"));
  s.on("connect_error", (e) => {
    if (e.message === "unauthorized") {
      // Session expired or revoked: sign the player out locally.
      disconnect();
      useProfile.getState().setSession(null);
      toast("Please sign in again", "Your session expired.", "error");
      return;
    }
    setStatus("offline");
  });
  s.on("account", ({ account, note }) => {
    useProfile.getState().setAccount(account);
    if (note) toast(note.title, note.body, "gold");
  });
  s.connect();
  return s;
}

function disconnect() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  playerId = null;
  setStatus("signed-out");
}

/** Connects once signed in and reports connection status. */
export function useSocket() {
  const hydrated = useProfile((p) => p.hydrated);
  const session = useProfile((p) => p.session);
  useEffect(() => {
    if (!hydrated) return;
    if (session) connect(session);
    else disconnect();
  }, [hydrated, session]);
  const st = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => "connecting" as const,
  );
  return { socket: hydrated && session ? socket : null, status: hydrated && !session ? ("signed-out" as const) : st, playerId };
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

/** Save a changed name or avatar to the account (no-op for guests). */
export async function saveProfile(name: string, avatar: string) {
  if (!socket?.connected) return;
  const r = await request<{ ok: true; account: import("@felt/engine").AccountInfo } | { ok: false; error: string }>((cb) =>
    socket!.emit("profile:update", { name, avatar }, cb),
  );
  if (r.ok) useProfile.getState().setAccount(r.account);
  else toast("Couldn't save your profile", r.error, "error");
}

// ── sign-in ──────────────────────────────────────────────────

/** Send the player to Google, then back to `next` on this site. */
export function signIn(next = window.location.pathname + window.location.search) {
  const back = `${window.location.origin}/auth/done?next=${encodeURIComponent(next)}`;
  if (process.env.NEXT_PUBLIC_DEV_LOGIN === "1") {
    const name = window.prompt("Dev sign-in: pick a username (each name is its own account)");
    if (!name) return;
    window.location.href = `${serverUrl()}/auth/dev?name=${encodeURIComponent(name)}&return=${encodeURIComponent(back)}`;
    return;
  }
  window.location.href = `${serverUrl()}/auth/google?return=${encodeURIComponent(back)}`;
}

export async function signOut() {
  const { session } = useProfile.getState();
  disconnect();
  useProfile.getState().setSession(null);
  if (session) {
    await fetch(`${serverUrl()}/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${session}` } }).catch(() => {});
  }
}
