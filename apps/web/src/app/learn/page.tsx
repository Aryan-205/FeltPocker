import Link from "next/link";
import { PageHeading, PageShell } from "@/components/page-shell";

const ITEMS = [
  {
    href: "/learn/rules",
    step: "01",
    title: "The Rules",
    body: "Blinds, the deal, the four betting rounds, your options and how a showdown works, for Hold'em and Omaha.",
    meta: "9 short lessons · ~10 min",
  },
  {
    href: "/learn/hands",
    step: "02",
    title: "Hand Rankings",
    body: "From high card to royal flush, with real examples, how often each hand comes up, and a quick-fire quiz.",
    meta: "10 hands + quiz",
  },
  {
    href: "/learn/practice",
    step: "03",
    title: "Practice Game",
    body: "Play against bots with practice chips. A coach at the top tells you the best move and what each choice leads to.",
    meta: "Live coach · Play money",
  },
];

export default function LearnPage() {
  return (
    <PageShell back={{ href: "/", label: "Lobby" }}>
      <PageHeading
        eyebrow="Learn to play"
        title={
          <>
            From first hand to <span className="gold-text italic">final table.</span>
          </>
        }
        body="Work through the three steps in order, or jump straight into a practice game. The coach explains every decision as you play."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {ITEMS.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="group glass shine relative flex min-h-64 flex-col overflow-hidden rounded-3xl p-7 transition duration-300 hover:-translate-y-1 hover:border-gold-300/30"
          >
            <span className="font-display text-6xl font-semibold text-white/[0.07] transition group-hover:text-gold-300/20">{it.step}</span>
            <h2 className="mt-2 font-display text-3xl font-semibold">{it.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-cream/55">{it.body}</p>
            <div className="mt-6 flex items-center justify-between text-xs">
              <span className="uppercase tracking-widest text-cream/40">{it.meta}</span>
              <span className="font-semibold text-gold-200 transition group-hover:translate-x-1">Start →</span>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
