import Link from "next/link";
import { HomeScene } from "@/components/home-scene";
import { TopBar } from "@/components/top-bar";

const MODES = [
  {
    href: "/online",
    eyebrow: "Public lobby",
    title: "Play Online",
    body: "Browse open tables or start your own. Anyone can pull up a chair.",
    suit: "♠",
    accent: "from-gold-300/25",
  },
  {
    href: "/friends",
    eyebrow: "Private room",
    title: "Play with Friends",
    body: "Host a closed table and share a 6-character code. Only invited players get in.",
    suit: "♥",
    accent: "from-ruby-400/25",
  },
  {
    href: "/learn",
    eyebrow: "Rules · Hands · Coach",
    title: "Learn to Play",
    body: "Master the rules and hand rankings, then practise against bots with a live coach.",
    suit: "♦",
    accent: "from-felt-500/35",
  },
];

export default function Home() {
  return (
    <main className="room-bg relative flex min-h-dvh flex-col overflow-hidden">
      <HomeScene />
      <TopBar />
      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 pb-16 pt-6 text-center sm:pt-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.45em] text-gold-300/80">The private poker room</p>
        <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
          Every hand,
          <br />
          <span className="gold-text italic">beautifully played.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-cream/60 sm:text-base">
          Texas Hold&apos;em and Pot-Limit Omaha with play-money chips. Learn the game, then take a seat.
        </p>

        <div className="mt-10 grid w-full gap-4 sm:mt-14 md:grid-cols-3">
          {MODES.map((m, i) => (
            <Link
              key={m.href}
              href={m.href}
              className="group glass shine relative overflow-hidden rounded-3xl p-6 text-left transition duration-300 hover:-translate-y-1.5 hover:border-gold-300/30 hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,.9),0_0_0_1px_rgba(223,189,111,.15)] sm:p-7"
              style={{ animation: `fadeUp .8s ${0.15 + i * 0.12}s both cubic-bezier(.2,.7,.2,1)` }}
            >
              <div className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${m.accent} to-transparent blur-2xl transition group-hover:scale-125`} />
              <span className="absolute right-6 top-4 font-display text-6xl text-white/[0.06] transition group-hover:text-gold-300/15">{m.suit}</span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold-300/70">{m.eyebrow}</p>
              <h2 className="mt-3 font-display text-3xl font-semibold">{m.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-cream/55">{m.body}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-200">
                Enter
                <span className="transition group-hover:translate-x-1">→</span>
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-10 text-xs text-cream/35">Play money only. Felt never uses real money and has no real-money prizes.</p>
      </section>
    </main>
  );
}
