"use client";

import type { Card, SeatView, TableView } from "@felt/engine";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { compact, fmt } from "@/lib/store";
import { cn } from "@/lib/cn";
import { PlayingCard } from "../cards/playing-card";
import { BetChips, ChipStack } from "./chips";

export interface PokerTableProps {
  view: TableView;
  turnDeadline?: number | null;
  actionTime?: number;
  away?: number[];
  /** Called when an empty seat is clicked (only when the viewer may sit). */
  onSit?: (seat: number) => void;
  /** Extra labels under a player's name, e.g. bot style. */
  tags?: Record<number, string>;
  /** Overlay content rendered in the centre of the felt (e.g. "waiting for host"). */
  center?: ReactNode;
}

type Pt = { x: number; y: number };

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 1000, h: 560 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e!.contentRect.width, h: e!.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Seat positions on an ellipse, rotated so the hero sits at the bottom centre. */
function layout(n: number, anchor: number, portrait: boolean) {
  const rx = portrait ? 40 : 45.5;
  const ry = portrait ? 44 : 41;
  return Array.from({ length: n }, (_, seat) => {
    const k = (seat - anchor + n) % n;
    const a = Math.PI / 2 + (k * 2 * Math.PI) / n;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return {
      seat: { x: 50 + rx * cos, y: 50 + ry * sin },
      // The hero's big cards sit higher, so their bet goes closer to the middle.
      bet: k === 0 ? { x: 41, y: 50 + ry * (portrait ? 0.4 : 0.36) } : { x: 50 + rx * 0.6 * cos, y: 50 + ry * (portrait ? 0.56 : 0.52) * sin },
      dealer: { x: 50 + rx * 0.72 * Math.cos(a - 0.32), y: 50 + ry * 0.66 * Math.sin(a - 0.32) },
      bottom: k === 0,
    };
  });
}

export function PokerTable({ view, turnDeadline, actionTime = 25, away = [], onSit, tags, center }: PokerTableProps) {
  const [ref, size] = useSize<HTMLDivElement>();
  const portrait = size.w / size.h < 0.95;
  const n = view.seats.length;
  const anchor = view.hero ?? 0;
  const pos = layout(n, anchor, portrait);
  const result = view.result;
  const winners = new Set(Object.keys(result?.won ?? {}).map(Number));
  const winningCards = new Set<Card>();
  if (result?.showdown) for (const w of winners) for (const c of result.revealed[w]?.best ?? []) winningCards.add(c);
  const complete = view.street === "complete";
  // chips already in the middle = total pot minus what's in front of players this street
  const streetBets = view.seats.reduce((a, p) => a + (p?.bet ?? 0), 0);
  const middle = complete ? 0 : view.pot - streetBets;

  return (
    <div ref={ref} className={cn("relative mx-auto w-full", portrait ? "aspect-[3/4.4] max-w-[560px]" : "aspect-[16/9.4] max-w-[1180px]")}>
      {/* Rail + felt */}
      <div className={cn("rail absolute rounded-[50%]", portrait ? "inset-x-[6%] inset-y-[5%]" : "inset-x-[5.5%] inset-y-[9%]")}>
        <div className="rail-trim absolute inset-[3.2%] rounded-[50%]">
          <div className="felt noise absolute inset-0 overflow-hidden rounded-[50%]">
            <div className="felt-line absolute inset-[7%] rounded-[50%]" />
            <div className="absolute inset-x-0 bottom-[16%] grid place-items-center">
              <span className="pointer-events-none select-none font-display text-[clamp(18px,3.2vw,40px)] font-bold italic tracking-tight text-black/[0.13] [text-shadow:0_1px_0_rgba(255,255,255,.04)]">
                Felt
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pot + board */}
      <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
        <AnimatePresence mode="popLayout">
          {middle > 0 && (
            <motion.div
              key="pot"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <ChipStack amount={middle} size="md" showLabel={false} />
              <span className="rounded-full bg-black/45 px-3 py-1 text-sm font-semibold tabular-nums text-gold-100 ring-1 ring-gold-300/20">
                Pot {fmt(middle)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <Board board={view.board} hand={view.handNumber} winning={winningCards} dimOthers={!!result?.showdown} small={portrait || size.w < 720} />
        <AnimatePresence>
          {complete && result && <ResultBanner view={view} key={`r${view.handNumber}`} />}
        </AnimatePresence>
        {center}
      </div>

      {/* Bets */}
      {view.seats.map((p, i) => {
        const b = pos[i]!.bet;
        return (
          <div key={`bet${i}`} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
            <BetChips amount={p?.bet ?? 0} />
          </div>
        );
      })}

      {/* Dealer button */}
      {view.button >= 0 && view.seats[view.button] && (
        <motion.div
          className="absolute z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-b from-white to-[#d9d4c7] text-[11px] font-extrabold text-ink-900 shadow-[0_3px_6px_rgba(0,0,0,.6)] ring-1 ring-black/20 sm:h-7 sm:w-7"
          animate={{ left: `${pos[view.button]!.dealer.x}%`, top: `${pos[view.button]!.dealer.y}%` }}
          initial={false}
          transition={{ type: "spring", stiffness: 140, damping: 20 }}
        >
          D
        </motion.div>
      )}

      {/* Seats */}
      {view.seats.map((p, i) => {
        const pt = pos[i]!.seat;
        const toCenter: Pt = { x: ((50 - pt.x) / 100) * size.w, y: ((50 - pt.y) / 100) * size.h };
        return (
          <div key={i} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pt.x}%`, top: `${pt.y}%` }}>
            {p ? (
              <Seat
                p={p}
                seat={i}
                view={view}
                hero={view.hero === i}
                acting={view.toAct === i && !complete}
                winner={winners.has(i)}
                won={result?.won[i] ?? 0}
                handName={result?.revealed[i]?.handName}
                winningCards={winningCards}
                away={away.includes(i)}
                deadline={view.toAct === i ? turnDeadline ?? null : null}
                actionTime={actionTime}
                dealFrom={toCenter}
                tag={tags?.[i]}
                compactMode={portrait || size.w < 720}
              />
            ) : (
              <EmptySeat onSit={onSit ? () => onSit(i) : undefined} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Board({ board, hand, winning, dimOthers, small }: { board: Card[]; hand: number; winning: Set<Card>; dimOthers: boolean; small: boolean }) {
  return (
    <div className="flex gap-1.5 sm:gap-2">
      {Array.from({ length: 5 }, (_, i) => {
        const c = board[i];
        return (
          <div key={i} className={cn("relative aspect-[5/7]", small ? "w-10" : "w-[4.6rem]")}>
            <div className="absolute inset-0 rounded-[8px] border border-dashed border-white/10 bg-black/10" />
            {c !== undefined && (
              <PlayingCard
                key={`${hand}-${i}`}
                card={c}
                size={small ? "sm" : "lg"}
                className="absolute inset-0"
                delay={i < 3 ? i * 0.12 : 0}
                dealFrom={{ x: 0, y: -30 }}
                highlight={winning.has(c)}
                dim={dimOthers && winning.size > 0 && !winning.has(c)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResultBanner({ view }: { view: TableView }) {
  const r = view.result!;
  const lines = r.pots.map((pot, idx) => {
    const names = pot.winners.map((w) => view.seats[w]?.name ?? "Player").join(" & ");
    const potName = r.pots.length > 1 ? (idx === 0 ? "Main pot" : `Side pot ${idx}`) : "";
    return `${potName ? potName + ": " : ""}${names} ${pot.winners.length > 1 ? "split" : "wins"} ${fmt(pot.amount)}${pot.handName ? ` — ${pot.handName}` : ""}`;
  });
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.5 }}
      className="max-w-[min(90vw,440px)] rounded-2xl bg-black/55 px-4 py-2 text-center ring-1 ring-gold-300/30 backdrop-blur"
    >
      {lines.map((l) => (
        <p key={l} className="text-[13px] font-semibold text-gold-100 sm:text-sm">
          {l}
        </p>
      ))}
    </motion.div>
  );
}

function EmptySeat({ onSit }: { onSit?: () => void }) {
  if (!onSit)
    return <div className="grid h-14 w-14 place-items-center rounded-full border border-dashed border-white/12 bg-black/25 text-[10px] uppercase tracking-widest text-white/25 sm:h-16 sm:w-16">Empty</div>;
  return (
    <button
      onClick={onSit}
      className="group grid h-14 w-14 place-items-center rounded-full border border-dashed border-gold-300/40 bg-black/35 text-[10px] font-semibold uppercase tracking-widest text-gold-200/80 transition hover:scale-105 hover:border-gold-300 hover:bg-gold-400/10 hover:text-gold-100 sm:h-16 sm:w-16"
    >
      Sit
    </button>
  );
}

const ACTION_LABEL: Record<string, string> = {
  fold: "Fold",
  check: "Check",
  call: "Call",
  bet: "Bet",
  raise: "Raise",
  allin: "All-in",
  sb: "Small blind",
  bb: "Big blind",
};

function Seat({
  p,
  seat,
  view,
  hero,
  acting,
  winner,
  won,
  handName,
  winningCards,
  away,
  deadline,
  actionTime,
  dealFrom,
  tag,
  compactMode,
}: {
  p: SeatView;
  seat: number;
  view: TableView;
  hero: boolean;
  acting: boolean;
  winner: boolean;
  won: number;
  handName?: string;
  winningCards: Set<Card>;
  away: boolean;
  deadline: number | null;
  actionTime: number;
  dealFrom: Pt;
  tag?: string;
  compactMode: boolean;
}) {
  const folded = p.folded && !p.sittingOut;
  const showCards = !p.sittingOut && p.hole.length > 0 && !(folded && !hero);
  const cardSize = hero ? (compactMode ? "md" : "lg") : compactMode ? "xs" : "sm";
  const omaha = p.hole.length === 4;
  const overlap = hero ? (omaha ? (compactMode ? "-ml-7" : "-ml-9") : "-ml-3") : omaha ? (compactMode ? "-ml-5" : "-ml-7") : "-ml-3";
  const action = p.lastAction;

  return (
    <div className={cn("relative flex flex-col items-center", folded && "opacity-60")}>
      {/* Action badge */}
      <AnimatePresence>
        {action && view.street !== "complete" && (
          <motion.span
            key={`${action.kind}${action.amount}${view.street}`}
            initial={{ opacity: 0, y: 6, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              hero ? "-right-2 top-[45%] translate-x-full" : "-top-6",
              "absolute z-30 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-lg sm:text-[11px]",
              action.kind === "fold" && "bg-ink-700 text-cream/60",
              (action.kind === "check" || action.kind === "call") && "bg-felt-600 text-white",
              (action.kind === "bet" || action.kind === "raise") && "bg-gold-400 text-ink-900",
              action.kind === "allin" && "bg-ruby-500 text-white",
              (action.kind === "sb" || action.kind === "bb") && "bg-black/60 text-cream/70",
            )}
          >
            {ACTION_LABEL[action.kind]}
            {action.amount > 0 && action.kind !== "sb" && action.kind !== "bb" ? ` ${compact(action.amount)}` : ""}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Cards */}
      <div className={cn("flex", hero ? "mb-[-14px]" : "mb-[-10px]", "relative z-0")}>
        {showCards &&
          p.hole.map((c, k) => (
            <PlayingCard
              key={`${view.handNumber}-${k}`}
              card={c}
              size={cardSize}
              className={cn(k > 0 && overlap, !hero && !omaha && (k === 0 ? "-rotate-6" : "rotate-6"))}
              delay={k * 0.15 + seat * 0.04}
              dealFrom={dealFrom}
              highlight={c !== null && winningCards.has(c)}
              dim={folded}
            />
          ))}
      </div>

      {/* Avatar + plate */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative">
          <TimerRing deadline={deadline} total={actionTime} acting={acting} compactMode={compactMode} />
          <div
            className={cn(
              "relative grid place-items-center rounded-full bg-gradient-to-b from-ink-700 to-ink-900 ring-2 transition-all",
              compactMode ? "h-11 w-11 text-xl" : "h-14 w-14 text-2xl",
              acting ? "ring-gold-300" : winner ? "ring-gold-300" : hero ? "ring-gold-500/60" : "ring-white/15",
              winner && "shadow-[0_0_40px_6px_rgba(223,189,111,.55)]",
            )}
          >
            <span className={cn(away && "opacity-40")}>{p.avatar}</span>
            {away && <span className="absolute -bottom-1 rounded-full bg-black/80 px-1.5 text-[9px] font-bold uppercase text-cream/70">away</span>}
          </div>
        </div>
        <div
          className={cn(
            "-mt-2 min-w-[92px] rounded-xl px-3 pb-1 pt-2 text-center ring-1 backdrop-blur-md",
            compactMode ? "min-w-[76px] px-2" : "",
            hero ? "bg-gradient-to-b from-ink-700/95 to-ink-900/95 ring-gold-400/40" : "bg-ink-900/85 ring-white/10",
          )}
        >
          <p className={cn("max-w-[110px] truncate font-semibold leading-tight", compactMode ? "text-[11px]" : "text-[13px]")}>{p.name}</p>
          <p className={cn("font-bold tabular-nums leading-tight text-gold-200", compactMode ? "text-[11px]" : "text-[13px]")}>
            {p.sittingOut && p.stack === 0 ? "Busted" : p.allIn && !view.result ? "ALL-IN" : compact(p.stack)}
          </p>
          {tag && <p className="text-[9px] uppercase tracking-wider text-cream/40">{tag}</p>}
        </div>
      </div>

      {/* Winner */}
      <AnimatePresence>
        {winner && won > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 0, scale: 0.7 }}
            animate={{ opacity: 1, y: -18, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 260, damping: 18 }}
            className="absolute -bottom-9 z-40 flex flex-col items-center"
          >
            <span className="whitespace-nowrap rounded-full bg-gradient-to-b from-gold-200 to-gold-500 px-3 py-0.5 text-xs font-extrabold text-ink-900 shadow-[0_8px_24px_-6px_rgba(212,169,79,.9)]">
              +{fmt(won)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {handName && view.street === "complete" && (
        <span className="absolute -bottom-[3.2rem] z-30 whitespace-nowrap rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-cream/80">
          {handName}
        </span>
      )}
    </div>
  );
}

function TimerRing({ deadline, total, acting, compactMode }: { deadline: number | null; total: number; acting: boolean; compactMode: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [deadline]);
  if (!acting) return null;
  const sz = compactMode ? 56 : 68;
  const r = sz / 2 - 3;
  const circ = 2 * Math.PI * r;
  const left = deadline ? Math.max(0, Math.min(1, (deadline - now) / (total * 1000))) : 1;
  const color = left > 0.5 ? "#dfbd6f" : left > 0.2 ? "#e0742a" : "#f0566b";
  return (
    <svg
      width={sz}
      height={sz}
      className={cn("pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90", !deadline && "pulse-ring rounded-full")}
    >
      <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="3" />
      <circle
        cx={sz / 2}
        cy={sz / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - left)}
        style={{ transition: "stroke-dashoffset .2s linear, stroke .4s" }}
      />
    </svg>
  );
}
