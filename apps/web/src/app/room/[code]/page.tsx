import { Suspense } from "react";
import { RoomClient } from "@/components/rooms/room-client";

export default function RoomPage({ params }: PageProps<"/room/[code]">) {
  return (
    <Suspense fallback={<main className="room-bg min-h-dvh" />}>
      <RoomClient params={params} />
    </Suspense>
  );
}
