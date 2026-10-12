"use client";

import { parseCard } from "@felt/engine";
import { motion } from "motion/react";
import { StaticCard } from "./cards/playing-card";
import { ChipStack } from "./table/chips";

/** The decorative, perspective poker table behind the home menu. */
export function HomeScene() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* spotlight */}
      <div className="absolute left-1/2 top-[-20%] h-[90vh] w-[120vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,240,200,0.10),transparent_60%)]" />
      {/* the table, seen from a seat */}
      <div className="absolute inset-x-0 bottom-[-40vh] flex justify-center [perspective:1400px] sm:bottom-[-34vh]">
        <motion.div
          initial={{ opacity: 0, rotateX: 64, y: 80 }}
          animate={{ opacity: 1, rotateX: 58, y: 0 }}
          transition={{ duration: 1.6, ease: [0.2, 0.7, 0.2, 1] }}
          className="relative h-[85vh] w-[150vw] max-w-[1900px] [transform-style:preserve-3d] sm:w-[110vw]"
        >
          <div className="rail absolute inset-0 rounded-[50%]">
            <div className="rail-trim absolute inset-[3%] rounded-[50%]">
              <div className="felt noise absolute inset-0 overflow-hidden rounded-[50%]">
                <div className="felt-line absolute inset-[8%] rounded-[50%]" />
                <div className="felt-line absolute inset-x-[34%] inset-y-[30%] rounded-[50%] opacity-60" />
              </div>
            </div>
          </div>
          {/* cards and chips on the felt */}
          <div className="absolute left-1/2 top-[17%] flex -translate-x-1/2 gap-3 [transform:translateZ(1px)]">
            {["Ah", "Kh", "Qh", "Jh", "Th"].map((c, i) => (
              <motion.div
                key={c}
                initial={{ opacity: 0, y: -60, rotateZ: -20 }}
                animate={{ opacity: 1, y: 0, rotateZ: 0 }}
                transition={{ delay: 0.9 + i * 0.12, type: "spring", stiffness: 140, damping: 16 }}
              >
                <StaticCard card={parseCard(c)} size="xl" className="shadow-2xl" />
              </motion.div>
            ))}
          </div>
          <div className="absolute left-[27%] top-[22%] scale-[2.2]">
            <ChipStack amount={3725} size="lg" showLabel={false} />
          </div>
          <div className="absolute right-[27%] top-[20%] scale-[2.2]">
            <ChipStack amount={12480} size="lg" showLabel={false} />
          </div>
        </motion.div>
      </div>
      {/* floating cards */}
      <FloatCard card="As" className="left-[6%] top-[22%] hidden md:block" r={-14} delay={0.2} />
      <FloatCard card="Ks" className="right-[7%] top-[16%] hidden md:block" r={12} delay={0.4} />
      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_35%,rgba(0,0,0,0.75)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink-950 to-transparent" />
    </div>
  );
}

function FloatCard({ card, className, r, delay }: { card: string | null; className: string; r: number; delay: number }) {
  return (
    <motion.div
      className={`absolute ${className}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 0.85, scale: 1 }}
      transition={{ delay: delay + 0.6, duration: 1 }}
    >
      <div className="float-slow drop-shadow-[0_30px_30px_rgba(0,0,0,.6)]" style={{ ["--r" as string]: `${r}deg`, animationDelay: `${delay * -3}s` }}>
        <StaticCard card={card ? parseCard(card) : null} size="xl" />
      </div>
    </motion.div>
  );
}
