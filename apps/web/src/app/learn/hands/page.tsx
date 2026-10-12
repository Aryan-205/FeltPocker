import { PageHeading, PageShell } from "@/components/page-shell";
import { HandRankings } from "@/components/learn/hand-rankings";
import { HandQuiz } from "@/components/learn/hand-quiz";

export default function HandsPage() {
  return (
    <PageShell back={{ href: "/learn", label: "Learn" }} title="Hand Rankings">
      <PageHeading
        eyebrow="Hand rankings"
        title={
          <>
            Know what <span className="gold-text italic">beats what.</span>
          </>
        }
        body="Hands are ranked from strongest to weakest. When two players have the same type of hand, the higher cards win, then the kickers (side cards). Suits are never ranked."
      />
      <HandRankings />
      <HandQuiz />
    </PageShell>
  );
}
