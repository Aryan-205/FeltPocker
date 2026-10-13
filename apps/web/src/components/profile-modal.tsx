"use client";

import { useState } from "react";
import { saveProfile, signIn, signOut } from "@/lib/socket";
import { AVATARS, STARTING_BANKROLL, fmt, useProfile } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";

export function ProfileModal({ open, onClose, firstTime }: { open: boolean; onClose: () => void; firstTime?: boolean }) {
  const profile = useProfile();
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const valid = name.trim().length >= 2;

  const save = () => {
    if (!valid) return;
    profile.setProfile(name, avatar);
    void saveProfile(name.trim(), avatar);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} dismissable={!firstTime}>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300/80">
          {firstTime ? "Welcome to the room" : "Your profile"}
        </p>
        <h2 className="mt-2 font-display text-3xl font-semibold">{firstTime ? "Take a seat" : "Edit profile"}</h2>
        {firstTime && (
          <p className="mt-2 text-sm text-cream/60">
            Pick a table name and avatar. Learn and practise right away, then sign in with Google to play online with{" "}
            <span className="font-semibold text-gold-200">{fmt(STARTING_BANKROLL)}</span> play chips. No real money, ever.
          </p>
        )}
      </div>
      <form
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-cream/50">Table name</span>
          <input
            autoFocus
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. RiverRat"
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-lg outline-none transition focus:border-gold-400/60 focus:ring-4 focus:ring-gold-400/10"
          />
        </label>
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-cream/50">Avatar</span>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {AVATARS.map((a) => (
              <button
                type="button"
                key={a}
                onClick={() => setAvatar(a)}
                className={cn(
                  "grid aspect-square place-items-center rounded-xl border text-2xl transition",
                  a === avatar
                    ? "border-gold-300 bg-gold-400/15 shadow-[0_0_20px_-4px_rgba(212,169,79,.6)]"
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                )}
                aria-label={`Avatar ${a}`}
                aria-pressed={a === avatar}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={!valid}>
          {firstTime ? "Enter the room" : "Save"}
        </Button>
        {!firstTime && (
          <p className="text-center text-xs text-cream/45">
            {profile.session ? (
              <>
                Signed in with Google.{" "}
                <button
                  type="button"
                  className="font-semibold text-cream/70 underline-offset-2 hover:underline"
                  onClick={() => {
                    void signOut();
                    onClose();
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                Playing as a guest.{" "}
                <button type="button" className="font-semibold text-gold-200 underline-offset-2 hover:underline" onClick={() => signIn()}>
                  Sign in to play online
                </button>
              </>
            )}
          </p>
        )}
      </form>
    </Modal>
  );
}
