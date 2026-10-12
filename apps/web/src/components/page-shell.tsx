import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TopBar } from "./top-bar";

export function PageShell({
  children,
  back,
  title,
  className,
}: {
  children: ReactNode;
  back?: { href: string; label: string };
  title?: string;
  className?: string;
}) {
  return (
    <main className="room-bg relative flex min-h-dvh flex-col">
      <TopBar back={back} title={title} />
      <div className={cn("relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-8", className)}>{children}</div>
    </main>
  );
}

export function PageHeading({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body?: ReactNode }) {
  return (
    <div className="mb-8 mt-4 sm:mb-12 sm:mt-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-gold-300/80">{eyebrow}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-6xl">{title}</h1>
      {body && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-cream/60">{body}</p>}
    </div>
  );
}
