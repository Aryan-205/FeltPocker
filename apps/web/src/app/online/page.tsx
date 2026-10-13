import { SignInGate } from "@/components/auth/sign-in-gate";
import { PageHeading, PageShell } from "@/components/page-shell";
import { LobbyClient } from "@/components/rooms/lobby-client";

export default function OnlinePage() {
  return (
    <PageShell back={{ href: "/", label: "Lobby" }} title="Play Online">
      <PageHeading
        eyebrow="Public lobby"
        title={
          <>
            Find your <span className="gold-text italic">seat.</span>
          </>
        }
        body="Open tables run around the clock. Join one or open your own, and anyone browsing the lobby can sit down. Play money only."
      />
      <SignInGate>
        <LobbyClient />
      </SignInGate>
    </PageShell>
  );
}
