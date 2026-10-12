"use client";

import type { TableView } from "@felt/engine";
import { useEffect, useRef } from "react";
import { sfx } from "@/lib/sound";

/** Plays sound effects for new log events and when it becomes the hero's turn. */
export function useTableSounds(view: TableView | null) {
  const seen = useRef({ hand: -1, n: 0, turn: "" });
  useEffect(() => {
    if (!view) return;
    const s = seen.current;
    if (view.handNumber !== s.hand) {
      s.hand = view.handNumber;
      s.n = 0;
    }
    const fresh = view.log.slice(s.n);
    s.n = view.log.length;
    let delay = 0;
    for (const e of fresh) {
      const play = (fn: () => void) => {
        setTimeout(fn, delay);
        delay += 90;
      };
      if (e.t === "start") play(() => sfx.card());
      else if (e.t === "street") play(() => sfx.card());
      else if (e.t === "action") {
        if (e.kind === "check") play(() => sfx.check());
        else if (e.kind === "fold") play(() => sfx.fold());
        else play(() => sfx.chips(e.kind === "allin" ? 6 : 3));
      } else if (e.t === "win" && view.hero === e.seat) play(() => sfx.win());
      else if (e.t === "win") play(() => sfx.chips(5));
    }
    const turnKey = `${view.handNumber}:${view.street}:${view.log.length}`;
    if (view.legal && view.toAct === view.hero && s.turn !== turnKey) {
      s.turn = turnKey;
      setTimeout(() => sfx.turn(), delay + 150);
    }
  }, [view]);
}
