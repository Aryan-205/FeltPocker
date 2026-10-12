"use client";

import Link from "next/link";
import { useState } from "react";
import { compact, fmt, useProfile } from "@/lib/store";
import { cn } from "@/lib/cn";
import { ChipIcon } from "./ui/chip-icon";
import { Logo } from "./ui/logo";
import { ProfileModal } from "./profile-modal";

export function TopBar({ back, title, className }: { back?: { href: string; label: string }; title?: string; className?: string }) {
  const { name, avatar, bankroll, hydrated, muted, toggleMute } = useProfile();
  const [edit, setEdit] = useState(false);

  return (
    <header className={cn("relative z-20 flex h-16 items-center justify-between gap-3 px-4 sm:h-20 sm:px-8", className)}>
      <div className="flex min-w-0 items-center gap-4">
        <Logo />
        {back && (
          <Link
            href={back.href}
            className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-cream/60 transition hover:bg-white/5 hover:text-cream sm:inline-flex"
          >
            <span aria-hidden>←</span> {back.label}
          </Link>
        )}
        {title && <span className="hidden truncate font-display text-lg text-cream/70 md:inline">· {title}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleMute}
          className="grid h-10 w-10 place-items-center rounded-full text-cream/60 transition hover:bg-white/5 hover:text-cream"
          aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          title={muted ? "Sound off" : "Sound on"}
        >
          {muted ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="m22 9-6 6m0-6 6 6" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
          )}
        </button>
        <div className="glass flex h-10 items-center gap-2 rounded-full pl-1.5 pr-4" title={`${fmt(bankroll)} play chips`}>
          <ChipIcon className="h-7 w-7" />
          <span className="font-semibold tabular-nums text-gold-100">{hydrated ? compact(bankroll) : "—"}</span>
        </div>
        {hydrated && name && (
          <button
            onClick={() => setEdit(true)}
            className="glass flex h-10 items-center gap-2 rounded-full pl-1 pr-1 transition hover:bg-white/10 sm:pr-4"
            aria-label="Edit profile"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-lg">{avatar}</span>
            <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">{name}</span>
          </button>
        )}
      </div>
      {edit && <ProfileModal open onClose={() => setEdit(false)} />}
    </header>
  );
}
