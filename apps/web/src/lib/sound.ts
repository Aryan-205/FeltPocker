"use client";

import { useProfile } from "./store";

/** Tiny synthesized sound effects — no audio files needed. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || useProfile.getState().muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBurst(c: AudioContext, at: number, dur: number, freq: number, gain: number, q = 1) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(at);
}

function tone(c: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType = "sine") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
}

export const sfx = {
  card() {
    const c = audio();
    if (c) noiseBurst(c, c.currentTime, 0.07, 2800, 0.35, 0.8);
  },
  chips(count = 3) {
    const c = audio();
    if (!c) return;
    for (let i = 0; i < count; i++) {
      const t = c.currentTime + i * 0.045 + Math.random() * 0.02;
      noiseBurst(c, t, 0.04, 4200 + Math.random() * 1500, 0.28, 6);
      tone(c, t, 2400 + Math.random() * 600, 0.05, 0.03, "triangle");
    }
  },
  check() {
    const c = audio();
    if (!c) return;
    noiseBurst(c, c.currentTime, 0.05, 300, 0.7, 2);
    noiseBurst(c, c.currentTime + 0.11, 0.05, 300, 0.6, 2);
  },
  fold() {
    const c = audio();
    if (c) noiseBurst(c, c.currentTime, 0.12, 1600, 0.2, 0.5);
  },
  turn() {
    const c = audio();
    if (!c) return;
    tone(c, c.currentTime, 880, 0.18, 0.05);
    tone(c, c.currentTime + 0.09, 1320, 0.25, 0.04);
  },
  win() {
    const c = audio();
    if (!c) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, c.currentTime + i * 0.08, f, 0.5, 0.05, "triangle"));
  },
};
