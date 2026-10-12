"use client";

import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useRef } from "react";
import { hydrateProfile, useProfile } from "@/lib/store";
import { toast, useToasts } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { ProfileModal } from "./profile-modal";

export function Providers({ children }: { children: ReactNode }) {
  const hydrated = useProfile((s) => s.hydrated);
  const name = useProfile((s) => s.name);
  const claimed = useRef(false);

  useEffect(() => {
    void hydrateProfile();
  }, []);

  useEffect(() => {
    if (!hydrated || !name || claimed.current) return;
    claimed.current = true;
    const amount = useProfile.getState().claimDailyBonus();
    if (amount) toast(`Daily bonus: +${amount.toLocaleString()} chips`, "Come back tomorrow for more.", "gold");
  }, [hydrated, name]);

  return (
    <>
      {children}
      <ProfileModal open={hydrated && !name} onClose={() => {}} firstTime />
      <Toaster />
    </>
  );
}

function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:right-4 sm:top-4 sm:left-auto sm:items-end">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            className={cn(
              "glass-strong pointer-events-auto w-full max-w-sm rounded-2xl px-4 py-3 text-left",
              t.tone === "error" && "border-ruby-400/40",
              t.tone === "gold" && "border-gold-300/50",
              t.tone === "success" && "border-felt-500/60",
            )}
          >
            <p className={cn("text-sm font-semibold", t.tone === "gold" && "text-gold-200", t.tone === "error" && "text-ruby-400")}>
              {t.title}
            </p>
            {t.body && <p className="mt-0.5 text-[13px] text-cream/60">{t.body}</p>}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
