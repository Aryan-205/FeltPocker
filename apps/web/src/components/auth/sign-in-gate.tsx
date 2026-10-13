"use client";

import type { ReactNode } from "react";
import { signIn } from "@/lib/socket";
import { STARTING_BANKROLL, fmt, useProfile } from "@/lib/store";
import { Button, ButtonLink } from "../ui/button";

/** Online tables need an account so chips can't be duplicated. Learn and Practice stay open. */
export function SignInGate({ children }: { children: ReactNode }) {
  const hydrated = useProfile((s) => s.hydrated);
  const session = useProfile((s) => s.session);
  if (!hydrated) return null;
  if (session) return <>{children}</>;
  return (
    <div className="glass-strong mx-auto max-w-md rounded-3xl p-8 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold-300/70">Online play</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">Sign in to take a seat</h2>
      <p className="mt-3 text-sm text-cream/60">
        Your chips are saved to your account, so they follow you to any device. New players start with{" "}
        <span className="font-semibold text-gold-200">{fmt(STARTING_BANKROLL)}</span> play chips, plus a daily bonus. No real money, ever.
      </p>
      <Button size="lg" className="mt-7 w-full" onClick={() => signIn()}>
        <GoogleMark /> Continue with Google
      </Button>
      <ButtonLink href="/learn/practice" variant="ghost" className="mt-3 w-full">
        Practise against bots without an account
      </ButtonLink>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}
