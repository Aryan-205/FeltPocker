import { PageHeading, PageShell } from "@/components/page-shell";
import { FriendsClient } from "@/components/rooms/friends-client";

export default function FriendsPage() {
  return (
    <PageShell back={{ href: "/", label: "Lobby" }} title="Play with Friends">
      <PageHeading
        eyebrow="Private room"
        title={
          <>
            Your table. <span className="gold-text italic">Your rules.</span>
          </>
        }
        body="Create a private room and share the code. Only people with the code can join. Everyone plays with play-money chips from their own bankroll."
      />
      <FriendsClient />
    </PageShell>
  );
}
