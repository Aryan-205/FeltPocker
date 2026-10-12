"use client";

import { AnimatePresence, motion } from "motion/react";
import { compact } from "@/lib/store";
import { cn } from "@/lib/cn";

const DENOMS = [
  { v: 5000, base: "#e0742a", edge: "#fff3e0" },
  { v: 1000, base: "#d4a94f", edge: "#1a1206" },
  { v: 500, base: "#6d3fb5", edge: "#f3e9ff" },
  { v: 100, base: "#1b1d22", edge: "#e9e9e9" },
  { v: 25, base: "#1f8a55", edge: "#effff6" },
  { v: 5, base: "#c42b3c", edge: "#fff0f0" },
  { v: 1, base: "#e9e4d8", edge: "#2a5bb5" },
];

export function Chip({ color, edge, className, style }: { color: string; edge: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={style} aria-hidden>
      <circle cx="20" cy="20" r="19.2" fill={color} />
      <circle cx="20" cy="20" r="19.2" fill="none" stroke={edge} strokeWidth="5.2" strokeDasharray="5.5 9.6" strokeOpacity=".95" />
      <circle cx="20" cy="20" r="13" fill={color} stroke="#000" strokeOpacity=".28" />
      <circle cx="20" cy="20" r="10.5" fill="none" stroke={edge} strokeOpacity=".55" strokeDasharray="1.8 1.8" />
      <ellipse cx="15" cy="12" rx="9" ry="4" fill="#fff" opacity=".18" />
    </svg>
  );
}

/** Break an amount into up to `max` chip piles of denominations. */
function breakdown(amount: number, max = 4): { v: number; base: string; edge: string; count: number }[] {
  const out: { v: number; base: string; edge: string; count: number }[] = [];
  let rest = amount;
  for (const d of DENOMS) {
    const c = Math.floor(rest / d.v);
    if (c > 0) {
      out.push({ ...d, count: Math.min(c, 8) });
      rest -= c * d.v;
    }
    if (out.length === max) break;
  }
  if (!out.length && amount > 0) out.push({ ...DENOMS[DENOMS.length - 1]!, count: 1 });
  return out;
}

export function ChipStack({ amount, size = "md", className, showLabel = true }: { amount: number; size?: "sm" | "md" | "lg"; className?: string; showLabel?: boolean }) {
  const piles = breakdown(amount, size === "lg" ? 5 : 3);
  const px = size === "lg" ? 28 : size === "md" ? 20 : 16;
  const step = size === "lg" ? 3.5 : size === "md" ? 2.6 : 2.2;
  return (
    <div className={cn("flex items-end gap-1.5", className)}>
      <div className="flex items-end -space-x-1">
        {piles.map((p) => (
          <div key={p.v} className="relative" style={{ width: px, height: px + (p.count - 1) * step }}>
            {Array.from({ length: p.count }, (_, i) => (
              <Chip
                key={i}
                color={p.base}
                edge={p.edge}
                className="absolute left-0 drop-shadow-[0_1.5px_1px_rgba(0,0,0,.6)]"
                style={{ width: px, height: px, bottom: i * step }}
              />
            ))}
          </div>
        ))}
      </div>
      {showLabel && (
        <span className="rounded-full bg-black/55 px-2 py-0.5 text-xs font-bold tabular-nums text-gold-100 ring-1 ring-white/10">
          {compact(amount)}
        </span>
      )}
    </div>
  );
}

/** Animated chips that pop in when a bet is placed. */
export function BetChips({ amount, className }: { amount: number; className?: string }) {
  return (
    <AnimatePresence>
      {amount > 0 && (
        <motion.div
          key="bet"
          className={className}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.35 } }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
        >
          <ChipStack amount={amount} size="sm" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
