import { Suspense } from "react";
import { RoomFromQuery } from "@/components/rooms/room-client";

/** `/room?code=ABC123`. A query string (not `/room/ABC123`) so the site can be a static export. */
export default function RoomPage() {
  return (
    <Suspense fallback={<main className="room-bg min-h-dvh" />}>
      <RoomFromQuery />
    </Suspense>
  );
}
