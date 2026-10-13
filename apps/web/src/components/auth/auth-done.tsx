"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { useProfile } from "@/lib/store";
import { ButtonLink } from "../ui/button";

interface Result {
  session: string | null;
  error: string | null;
  next: string;
}

// Read once: the fragment is wiped from the address bar right after.
let result: Result | null = null;
function readResult(): Result {
  if (!result) {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const next = new URLSearchParams(window.location.search).get("next");
    const session = hash.get("session");
    result = {
      session,
      error: session ? null : (hash.get("error") ?? "Sign-in didn't complete."),
      next: next && next.startsWith("/") && !next.startsWith("//") ? next : "/online",
    };
  }
  return result;
}
const noSubscribe = () => () => {};

/** Google sign-in lands here with `#session=…` (or `#error=…`) in the URL fragment. */
export function AuthDone() {
  const router = useRouter();
  const hydrated = useProfile((s) => s.hydrated);
  const r = useSyncExternalStore(noSubscribe, readResult, () => null);
  const error = r?.error ?? null;

  useEffect(() => {
    if (!r) return;
    // Strip the token from the address bar and history straight away.
    window.history.replaceState(null, "", window.location.pathname);
    if (!hydrated || !r.session) return;
    useProfile.getState().setSession(r.session);
    router.replace(r.next);
  }, [r, hydrated, router]);

  return (
    <main className="room-bg grid min-h-dvh place-items-center px-4">
      <div className="glass-strong max-w-sm rounded-3xl p-8 text-center">
        {error ? (
          <>
            <p className="font-display text-2xl font-semibold">Couldn&apos;t sign in</p>
            <p className="mt-2 text-sm text-cream/60">{error}</p>
            <ButtonLink href="/" className="mt-6">
              Back to the lobby
            </ButtonLink>
          </>
        ) : (
          <p className="font-display text-xl text-cream/70">Signing you in…</p>
        )}
      </div>
    </main>
  );
}
