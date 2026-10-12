"use client";

import { parseCards } from "@felt/engine";
import { motion } from "motion/react";
import { StaticCard } from "../cards/playing-card";

const HANDS = [
  { name: "Royal Flush", cards: "As Ks Qs Js Ts", used: 5, odds: "0.003%", desc: "A, K, Q, J, 10, all the same suit. The best hand in poker." },
  { name: "Straight Flush", cards: "9h 8h 7h 6h 5h", used: 5, odds: "0.03%", desc: "Five cards in a row, all the same suit." },
  { name: "Four of a Kind", cards: "Qc Qd Qh Qs 7d", used: 4, odds: "0.17%", desc: "Four cards of the same rank." },
  { name: "Full House", cards: "Kh Kd Ks 4c 4h", used: 5, odds: "2.6%", desc: "Three of a kind plus a pair. The higher trips win." },
  { name: "Flush", cards: "Ad Jd 8d 6d 2d", used: 5, odds: "3.0%", desc: "Any five cards of the same suit. Highest card decides ties." },
  { name: "Straight", cards: "Tc 9d 8s 7h 6c", used: 5, odds: "4.6%", desc: "Five cards in a row, any suits. A-2-3-4-5 is the lowest straight." },
  { name: "Three of a Kind", cards: "8s 8h 8d Kc 3h", used: 3, odds: "4.8%", desc: "Three cards of the same rank, also called trips or a set." },
  { name: "Two Pair", cards: "Jh Jc 5s 5d Ac", used: 4, odds: "23.5%", desc: "Two different pairs. The higher pair decides, then the lower one, then the kicker." },
  { name: "One Pair", cards: "Ah Ad Kc 9s 4h", used: 2, odds: "43.8%", desc: "Two cards of the same rank." },
  { name: "High Card", cards: "As Jd 9c 6h 3s", used: 1, odds: "17.4%", desc: "No combination. Your highest card plays." },
];

export function HandRankings() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {HANDS.map((h, i) => (
        <motion.div
          key={h.name}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ delay: (i % 2) * 0.06 }}
          className="glass group flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-4 sm:w-56 sm:shrink-0">
            <span className="font-display text-4xl font-semibold text-white/10 transition group-hover:text-gold-300/40">{i + 1}</span>
            <div>
              <h3 className="font-display text-xl font-semibold">{h.name}</h3>
              <p className="text-xs text-cream/45">{h.desc}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gold-300/60">{h.odds} of hands</p>
            </div>
          </div>
          <div className="flex gap-1">
            {parseCards(h.cards).map((c, k) => (
              <StaticCard key={k} card={c} size="sm" dim={k >= h.used} />
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
