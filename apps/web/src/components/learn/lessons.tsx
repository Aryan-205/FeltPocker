import { parseCards } from "@felt/engine";
import type { ReactNode } from "react";
import { StaticCard } from "../cards/playing-card";
import { ChipStack } from "../table/chips";

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  body: ReactNode;
  visual: ReactNode;
}

const Cards = ({ cards, size = "md", dim = [] as number[] }: { cards: string; size?: "sm" | "md" | "lg"; dim?: number[] }) => (
  <div className="flex gap-1.5">
    {parseCards(cards).map((c, i) => (
      <StaticCard key={i} card={c} size={size} dim={dim.includes(i)} />
    ))}
  </div>
);

const Backs = ({ n, size = "md" }: { n: number; size?: "sm" | "md" | "lg" }) => (
  <div className="flex gap-1.5">
    {Array.from({ length: n }, (_, i) => (
      <StaticCard key={i} card={null} size={size} />
    ))}
  </div>
);

const Label = ({ children }: { children: ReactNode }) => (
  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-300/70">{children}</p>
);

const MiniFelt = ({ children }: { children: ReactNode }) => (
  <div className="rail relative rounded-[48px] p-2.5">
    <div className="rail-trim rounded-[40px]">
      <div className="felt noise relative flex min-h-56 flex-col items-center justify-center gap-5 rounded-[40px] p-6">{children}</div>
    </div>
  </div>
);

const P = ({ children }: { children: ReactNode }) => <p className="leading-relaxed text-cream/70">{children}</p>;
const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-cream">{children}</strong>;

function PositionsDiagram() {
  const seats = [
    { label: "BTN", note: "Dealer", x: 50, y: 92, gold: true },
    { label: "SB", note: "Small blind", x: 88, y: 66 },
    { label: "BB", note: "Big blind", x: 88, y: 24 },
    { label: "UTG", note: "First to act", x: 50, y: 6 },
    { label: "HJ", note: "Middle", x: 12, y: 24 },
    { label: "CO", note: "Cutoff", x: 12, y: 66 },
  ];
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-md">
      <div className="rail absolute inset-[12%] rounded-[50%]">
        <div className="rail-trim absolute inset-[4%] rounded-[50%]">
          <div className="felt noise absolute inset-0 rounded-[50%]" />
        </div>
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <span className="rounded-full bg-black/40 px-3 py-1 text-[11px] text-cream/60">Action moves clockwise →</span>
      </div>
      {seats.map((s) => (
        <div key={s.label} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
          <div
            className={`mx-auto grid h-11 w-11 place-items-center rounded-full text-xs font-bold ring-2 ${
              s.gold ? "bg-gradient-to-b from-white to-[#d9d4c7] text-ink-900 ring-gold-300" : "bg-ink-800 text-cream ring-white/15"
            }`}
          >
            {s.label}
          </div>
          <p className="mt-1 whitespace-nowrap text-[10px] text-cream/50">{s.note}</p>
        </div>
      ))}
    </div>
  );
}

export const LESSONS: Lesson[] = [
  {
    id: "goal",
    title: "The goal of the game",
    summary: "Win chips, not hands.",
    body: (
      <>
        <P>
          Poker is a game of <B>chips</B>. Every hand there&apos;s a pot in the middle, and there are only two ways to win it:
        </P>
        <ol className="mt-4 space-y-3">
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold-400/20 text-xs font-bold text-gold-200">1</span>
            <P>
              <B>Have the best five-card hand</B> when the cards are revealed at the end (the <em>showdown</em>).
            </P>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold-400/20 text-xs font-bold text-gold-200">2</span>
            <P>
              <B>Make everyone else fold</B> by betting so they give up. You don&apos;t even need to show your cards.
            </P>
          </li>
        </ol>
        <P>
          <br />
          Good players don&apos;t try to win every hand. They win the most chips over many hands by folding weak hands cheaply and
          betting strong ones.
        </P>
      </>
    ),
    visual: (
      <MiniFelt>
        <ChipStack amount={2840} size="lg" />
        <Cards cards="As Ks" size="lg" />
        <p className="text-sm text-cream/70">Best hand or last player standing takes the pot.</p>
      </MiniFelt>
    ),
  },
  {
    id: "positions",
    title: "The table and the button",
    summary: "Who acts when.",
    body: (
      <>
        <P>
          A white disc called the <B>dealer button</B> (BTN) marks who is &ldquo;dealer&rdquo; for the hand. It moves one seat to the left
          after every hand, so everyone takes turns.
        </P>
        <P>
          <br />
          The two players to the left of the button post the <B>blinds</B>: forced bets that start the pot. The <B>small blind</B> is
          usually half the <B>big blind</B>.
        </P>
        <P>
          <br />
          <B>Position matters.</B> Players who act later see what everyone else did first. The button acts last on every round after
          the flop, which makes it the most profitable seat.
        </P>
      </>
    ),
    visual: <PositionsDiagram />,
  },
  {
    id: "deal",
    title: "The deal",
    summary: "Two private cards each.",
    body: (
      <>
        <P>
          After the blinds are posted, every player gets <B>two cards face-down</B>. These are your <B>hole cards</B>, and only you can see
          them.
        </P>
        <P>
          <br />
          Later, up to five <B>community cards</B> are dealt face-up in the middle. Everyone shares them. Your hand is the best five cards
          from your two hole cards plus the five on the board.
        </P>
      </>
    ),
    visual: (
      <MiniFelt>
        <div className="flex items-end gap-10">
          <div className="text-center">
            <Label>Opponent</Label>
            <Backs n={2} />
          </div>
          <div className="text-center">
            <Label>You</Label>
            <Cards cards="Qh Qd" />
          </div>
        </div>
        <div className="text-center">
          <Label>Community cards (shared)</Label>
          <Backs n={5} size="sm" />
        </div>
      </MiniFelt>
    ),
  },
  {
    id: "rounds",
    title: "The four betting rounds",
    summary: "Pre-flop, flop, turn, river.",
    body: (
      <>
        <ol className="space-y-3">
          {[
            ["Pre-flop", "After hole cards are dealt. The player left of the big blind acts first."],
            ["Flop", "Three community cards are dealt at once, then another round of betting."],
            ["Turn", "A fourth community card, then betting."],
            ["River", "The fifth and final card, then the last round of betting."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold-400/20 text-xs font-bold text-gold-200">{i + 1}</span>
              <P>
                <B>{t}:</B> {d}
              </P>
            </li>
          ))}
        </ol>
        <P>
          <br />
          After the flop, the first active player to the left of the button acts first. A round ends when everyone still in has put in
          the same amount (or is all-in).
        </P>
      </>
    ),
    visual: (
      <MiniFelt>
        <div className="space-y-3">
          {[
            ["Flop", "Jh 7c 2s", 3],
            ["Turn", "Jh 7c 2s Qd", 4],
            ["River", "Jh 7c 2s Qd 9h", 5],
          ].map(([t, c]) => (
            <div key={t as string} className="flex items-center gap-4">
              <span className="w-12 text-right text-xs font-semibold uppercase tracking-widest text-gold-200/70">{t}</span>
              <Cards cards={c as string} size="sm" />
            </div>
          ))}
        </div>
      </MiniFelt>
    ),
  },
  {
    id: "actions",
    title: "Your options",
    summary: "Fold, check, call, bet, raise.",
    body: (
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Fold", "Throw your cards away and give up the pot. Costs nothing more."],
          ["Check", "Pass without betting, only if nobody has bet yet this round."],
          ["Call", "Match the current bet to stay in."],
          ["Bet", "Be the first to put chips in on this round."],
          ["Raise", "Increase someone else's bet. A raise must be at least as big as the last bet or raise."],
          ["All-in", "Put in all your chips. You can only win as much as you put in from each opponent."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/5">
            <p className="font-display text-lg font-semibold text-gold-100">{t}</p>
            <p className="mt-1 text-sm leading-relaxed text-cream/60">{d}</p>
          </div>
        ))}
      </div>
    ),
    visual: (
      <MiniFelt>
        <div className="grid w-full max-w-xs grid-cols-3 gap-2">
          <div className="rounded-xl bg-ink-700 py-3 text-center text-xs font-bold uppercase tracking-wider text-cream/80">Fold</div>
          <div className="rounded-xl bg-felt-600 py-3 text-center text-xs font-bold uppercase tracking-wider">Call 40</div>
          <div className="btn-gold rounded-xl py-3 text-center text-xs font-bold uppercase tracking-wider">Raise 120</div>
        </div>
        <p className="max-w-xs text-center text-sm text-cream/60">When nobody has bet, &ldquo;Call&rdquo; becomes &ldquo;Check&rdquo; and &ldquo;Raise&rdquo; becomes &ldquo;Bet&rdquo;.</p>
      </MiniFelt>
    ),
  },
  {
    id: "showdown",
    title: "The showdown",
    summary: "Best five cards wins.",
    body: (
      <>
        <P>
          If two or more players are left after the river, they reveal their cards. Each player makes the <B>best possible five-card hand</B>{" "}
          from their 2 hole cards and the 5 community cards, using both, one or even none of their hole cards.
        </P>
        <P>
          <br />
          The best hand wins the pot. If hands are exactly equal, the pot is <B>split</B>. Suits never break ties.
        </P>
        <P>
          <br />
          In the example, you hold A♥ K♥ and make a <B>flush</B> with three hearts on the board. Your opponent&apos;s set of sevens loses.
        </P>
      </>
    ),
    visual: (
      <MiniFelt>
        <div className="text-center">
          <Label>Board</Label>
          <Cards cards="7h 2h Jc 9h 7d" size="sm" />
        </div>
        <div className="flex gap-8">
          <div className="text-center">
            <Label>You · Flush</Label>
            <Cards cards="Ah Kh" size="sm" />
          </div>
          <div className="text-center opacity-60">
            <Label>Opponent · Trips</Label>
            <Cards cards="7s 4c" size="sm" />
          </div>
        </div>
      </MiniFelt>
    ),
  },
  {
    id: "sidepots",
    title: "All-ins and side pots",
    summary: "You can't win more than you risk.",
    body: (
      <>
        <P>
          If a player goes all-in with fewer chips than others, the others keep betting into a separate <B>side pot</B>.
        </P>
        <P>
          <br />
          Example: Ana is all-in for <B>100</B>. Ben and Cal each put in <B>300</B>. The <B>main pot</B> is 300 (100 from each), and
          everyone can win it. The <B>side pot</B> is 400 (the extra 200 from Ben and Cal), and only Ben and Cal can win it.
        </P>
        <P>
          <br />
          Felt calculates all of this for you automatically.
        </P>
      </>
    ),
    visual: (
      <MiniFelt>
        <div className="flex gap-10">
          <div className="text-center">
            <ChipStack amount={300} size="lg" />
            <p className="mt-2 text-xs text-cream/60">Main pot · Ana, Ben, Cal</p>
          </div>
          <div className="text-center">
            <ChipStack amount={400} size="lg" />
            <p className="mt-2 text-xs text-cream/60">Side pot · Ben, Cal</p>
          </div>
        </div>
      </MiniFelt>
    ),
  },
  {
    id: "omaha",
    title: "Pot-Limit Omaha",
    summary: "Four cards, use exactly two.",
    body: (
      <>
        <P>
          Omaha plays just like Hold&apos;em with two big differences:
        </P>
        <ul className="mt-3 space-y-2">
          <li>
            <P>
              • You get <B>four hole cards</B> and must use <B>exactly two</B> of them, plus <B>exactly three</B> from the board.
            </P>
          </li>
          <li>
            <P>
              • It&apos;s <B>pot-limit</B>: the most you can raise is the size of the pot, so there are no huge over-bets.
            </P>
          </li>
        </ul>
        <P>
          <br />
          The classic trap: four spades on the board and one spade in your hand is <B>not</B> a flush in Omaha. You need two spades of
          your own.
        </P>
      </>
    ),
    visual: (
      <MiniFelt>
        <div className="text-center">
          <Label>Board · four spades</Label>
          <Cards cards="3s 7s 9s Js 4d" size="sm" />
        </div>
        <div className="text-center">
          <Label>Your hand · only one spade → no flush</Label>
          <Cards cards="As Kd Qc 2h" size="sm" />
        </div>
      </MiniFelt>
    ),
  },
  {
    id: "strategy",
    title: "Five habits of winning players",
    summary: "Simple strategy that works.",
    body: (
      <ol className="space-y-3">
        {[
          ["Play fewer, stronger hands.", "Big pairs, high cards like A-K and A-Q, and suited connectors in late position."],
          ["Respect position.", "Play more hands on the button, fewer in early seats."],
          ["Bet your strong hands.", "Make weaker hands pay to see more cards."],
          ["Use pot odds.", "Only call if your chance of winning beats the price. The practice coach shows you both numbers."],
          ["Don't chase losses.", "Folding is a winning move. Saved chips count just as much as won ones."],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold-400/20 text-xs font-bold text-gold-200">{i + 1}</span>
            <P>
              <B>{t}</B> {d}
            </P>
          </li>
        ))}
      </ol>
    ),
    visual: (
      <MiniFelt>
        <div className="flex gap-6">
          <Cards cards="As Ad" size="sm" />
          <Cards cards="Ah Kh" size="sm" />
          <Cards cards="9s 8s" size="sm" />
        </div>
        <p className="text-sm text-cream/60">Strong starting hands to look for.</p>
      </MiniFelt>
    ),
  },
];
