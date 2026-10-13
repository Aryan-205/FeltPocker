"use client";

import type { AccountInfo } from "@felt/engine";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export { DAILY_BONUS, STARTING_BANKROLL } from "@felt/engine";
export const PRACTICE_STACK = 2_000;

export const AVATARS = ["🦊", "🐻", "🦁", "🐯", "🐼", "🦉", "🐺", "🐸", "🐙", "🦄", "🐲", "🦅"];

interface ProfileState {
  name: string;
  avatar: string;
  /** Login token from Google sign-in. Online play needs it; Learn and Practice don't. */
  session: string | null;
  /** The signed-in account as last reported by the server. Chips live on the server. */
  account: AccountInfo | null;
  practiceChips: number;
  muted: boolean;
  hydrated: boolean;
  setProfile(name: string, avatar: string): void;
  setSession(session: string | null): void;
  setAccount(account: AccountInfo | null): void;
  setPracticeChips(n: number): void;
  toggleMute(): void;
}

export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      name: "",
      avatar: AVATARS[0]!,
      session: null,
      account: null,
      practiceChips: PRACTICE_STACK,
      muted: false,
      hydrated: false,
      setProfile: (name, avatar) => set({ name: name.trim().slice(0, 20), avatar }),
      setSession: (session) => set(session ? { session } : { session: null, account: null }),
      // The server's profile wins once signed in, so every device shows the same name.
      setAccount: (account) => set(account ? { account, name: account.name, avatar: account.avatar } : { account: null }),
      setPracticeChips: (n) => set({ practiceChips: Math.max(0, Math.floor(n)) }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
    }),
    {
      name: "felt-profile",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ name, avatar, session, practiceChips, muted }) => ({ name, avatar, session, practiceChips, muted }),
      // v1 kept a play-money bankroll in the browser; chips now live on the server.
      migrate: (old) => {
        const o = (old ?? {}) as Partial<ProfileState>;
        return { name: o.name ?? "", avatar: o.avatar ?? AVATARS[0]!, session: null, practiceChips: o.practiceChips ?? PRACTICE_STACK, muted: !!o.muted } as ProfileState;
      },
      // Rehydrated from <Providers> after mount so server and client markup match.
      skipHydration: true,
    },
  ),
);

/** Load the saved profile from localStorage (call once on the client). */
export async function hydrateProfile() {
  if (useProfile.getState().hydrated) return;
  await useProfile.persist.rehydrate();
  useProfile.setState({ hydrated: true });
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return fmt(n);
}
