"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const STARTING_BANKROLL = 10_000;
export const DAILY_BONUS = 2_000;
export const PRACTICE_STACK = 2_000;

export const AVATARS = ["🦊", "🐻", "🦁", "🐯", "🐼", "🦉", "🐺", "🐸", "🐙", "🦄", "🐲", "🦅"];

const newToken = () =>
  globalThis.crypto?.randomUUID?.().replace(/-/g, "") + Math.random().toString(36).slice(2, 10);

interface ProfileState {
  token: string;
  name: string;
  avatar: string;
  bankroll: number;
  lastBonusDay: string | null;
  practiceChips: number;
  muted: boolean;
  hydrated: boolean;
  setProfile(name: string, avatar: string): void;
  debit(amount: number): boolean;
  credit(amount: number): void;
  claimDailyBonus(): number;
  setPracticeChips(n: number): void;
  toggleMute(): void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const useProfile = create<ProfileState>()(
  persist(
    (set, get) => ({
      token: "",
      name: "",
      avatar: AVATARS[0]!,
      bankroll: STARTING_BANKROLL,
      lastBonusDay: null,
      practiceChips: PRACTICE_STACK,
      muted: false,
      hydrated: false,
      setProfile: (name, avatar) => set({ name: name.trim().slice(0, 20), avatar }),
      debit: (amount) => {
        if (amount > get().bankroll) return false;
        set((s) => ({ bankroll: s.bankroll - amount }));
        return true;
      },
      credit: (amount) => set((s) => ({ bankroll: s.bankroll + Math.max(0, Math.floor(amount)) })),
      claimDailyBonus: () => {
        const s = get();
        if (s.lastBonusDay === today()) return 0;
        // Top up broke players a bit more generously.
        const amount = s.bankroll < 1_000 ? DAILY_BONUS * 2 : DAILY_BONUS;
        set({ bankroll: s.bankroll + amount, lastBonusDay: today() });
        return amount;
      },
      setPracticeChips: (n) => set({ practiceChips: Math.max(0, Math.floor(n)) }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
    }),
    {
      name: "felt-profile",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ hydrated: _h, ...rest }) => rest,
      // Rehydrated from <Providers> after mount so server and client markup match.
      skipHydration: true,
    },
  ),
);

/** Load the saved profile from localStorage (call once on the client). */
export async function hydrateProfile() {
  if (useProfile.getState().hydrated) return;
  await useProfile.persist.rehydrate();
  const s = useProfile.getState();
  useProfile.setState({ hydrated: true, token: s.token || newToken() });
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return fmt(n);
}
