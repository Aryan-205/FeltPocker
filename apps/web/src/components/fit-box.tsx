"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/**
 * Fills its parent and sizes the child to the largest width that keeps
 * `aspect` (w/h) within the available height. Used to fit the table between
 * the coach bar and the action bar.
 */
export function FitBox({ aspect, portraitAspect, children, maxWidth = 1180 }: { aspect: number; portraitAspect: number; children: ReactNode; maxWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width: w, height: h } = e!.contentRect;
      const portrait = w < 640;
      const a = portrait ? portraitAspect : aspect;
      // Seats overhang the table edge, so leave room above and below.
      setWidth(Math.min(maxWidth, w, h > 160 ? (h - 56) * a : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect, portraitAspect, maxWidth]);
  return (
    <div ref={ref} className="flex min-h-0 flex-1 items-center justify-center">
      <div style={{ width: width ?? "100%" }}>{children}</div>
    </div>
  );
}
