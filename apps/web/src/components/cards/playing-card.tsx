"use client";

import { RANKS, SUIT_SYMBOLS, rankOf, suitOf, type Card } from "@felt/engine";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export type CardSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<CardSize, { w: string; corner: string; pip: string; face: string; radius: string }> = {
  xs: { w: "w-7", corner: "text-[9px]", pip: "text-sm", face: "text-sm", radius: "rounded-[4px]" },
  sm: { w: "w-10", corner: "text-[11px]", pip: "text-xl", face: "text-lg", radius: "rounded-[5px]" },
  md: { w: "w-14", corner: "text-[13px]", pip: "text-[28px]", face: "text-2xl", radius: "rounded-[7px]" },
  lg: { w: "w-[4.6rem]", corner: "text-base", pip: "text-4xl", face: "text-3xl", radius: "rounded-[9px]" },
  xl: { w: "w-24", corner: "text-lg", pip: "text-5xl", face: "text-4xl", radius: "rounded-[11px]" },
};

const isRed = (c: Card) => suitOf(c) === 1 || suitOf(c) === 2;
const label = (c: Card) => (RANKS[rankOf(c)] === "T" ? "10" : RANKS[rankOf(c)]!);

function Face({ card, size }: { card: Card; size: CardSize }) {
  const s = SIZES[size];
  const suit = SUIT_SYMBOLS[suitOf(card)];
  const r = rankOf(card);
  const court = r >= 9 && r <= 11;
  const tiny = size === "xs";
  return (
    <div
      className={cn(
        "card-face absolute inset-0 overflow-hidden backface-hidden select-none",
        s.radius,
        isRed(card) ? "text-[#c3122f]" : "text-[#14161a]",
      )}
    >
      <div className={cn("absolute left-[8%] top-[5%] flex flex-col items-center font-bold leading-[0.95]", s.corner)}>
        <span className="font-display tracking-tighter">{label(card)}</span>
        <span className="-mt-px">{suit}</span>
      </div>
      {!tiny && (
        <div className={cn("absolute bottom-[5%] right-[8%] flex rotate-180 flex-col items-center font-bold leading-[0.95]", s.corner)}>
          <span className="font-display tracking-tighter">{label(card)}</span>
          <span className="-mt-px">{suit}</span>
        </div>
      )}
      <div className="absolute inset-0 grid place-items-center">
        {court ? (
          <div className="flex h-[58%] w-[58%] flex-col items-center justify-center rounded-[3px] border border-current/25 bg-gradient-to-b from-current/[0.04] to-current/[0.09]">
            <span className={cn("font-display font-bold leading-none", s.face)}>{label(card)}</span>
            <span className={cn("leading-none", s.corner)}>{suit}</span>
          </div>
        ) : (
          <span className={cn("leading-none", tiny ? "mt-2 text-xs" : s.pip, r === 12 && !tiny && "scale-125")}>{suit}</span>
        )}
      </div>
    </div>
  );
}

function Back({ size }: { size: CardSize }) {
  return <div className={cn("card-back absolute inset-0 backface-hidden", SIZES[size].radius)} />;
}

export function PlayingCard({
  card,
  size = "md",
  className,
  highlight,
  dim,
  delay = 0,
  dealFrom,
}: {
  /** null / undefined = face down. */
  card: Card | null | undefined;
  size?: CardSize;
  className?: string;
  highlight?: boolean;
  dim?: boolean;
  delay?: number;
  /** Offset (px) the card flies in from when dealt. */
  dealFrom?: { x: number; y: number };
}) {
  const faceUp = card !== null && card !== undefined;
  return (
    <motion.div
      className={cn("relative aspect-[5/7] shrink-0 [perspective:600px]", SIZES[size].w, className)}
      initial={dealFrom ? { x: dealFrom.x, y: dealFrom.y, opacity: 0, rotate: -12, scale: 0.6 } : false}
      animate={{
        x: 0,
        y: highlight ? -6 : 0,
        opacity: dim ? 0.35 : 1,
        rotate: 0,
        scale: 1,
        filter: dim ? "grayscale(0.7)" : "grayscale(0)",
      }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay }}
    >
      <motion.div
        className="absolute inset-0 [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: faceUp ? 0 : 180 }}
        transition={{ duration: 0.55, ease: [0.3, 0.7, 0.2, 1], delay: faceUp ? delay + 0.05 : 0 }}
      >
        {faceUp && <Face card={card} size={size} />}
        <div className="absolute inset-0 [transform:rotateY(180deg)] backface-hidden">
          <Back size={size} />
        </div>
      </motion.div>
      {highlight && (
        <div className={cn("pointer-events-none absolute -inset-[3px] ring-2 ring-gold-300 shadow-[0_0_24px_rgba(223,189,111,.7)]", SIZES[size].radius)} />
      )}
    </motion.div>
  );
}

/** Static card for illustrations (lessons, hand rankings) — no animation. */
export function StaticCard({ card, size = "md", className, dim }: { card: Card | null; size?: CardSize; className?: string; dim?: boolean }) {
  return (
    <div className={cn("relative aspect-[5/7] shrink-0", SIZES[size].w, dim && "opacity-35 grayscale", className)}>
      {card === null ? <Back size={size} /> : <Face card={card} size={size} />}
    </div>
  );
}
