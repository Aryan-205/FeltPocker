"use client";

import type { ChatMessage } from "@felt/engine";
import { useEffect, useRef, useState } from "react";
import type { FeltSocket } from "@/lib/socket";
import { cn } from "@/lib/cn";

export function Chat({ messages, socket }: { messages: ChatMessage[]; socket: FeltSocket | null }) {
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = () => {
    const t = text.trim();
    if (!t || !socket) return;
    socket.emit("chat:send", { text: t });
    setText("");
  };

  return (
    <div className="glass-strong flex h-full min-h-0 flex-col rounded-3xl">
      <div className="border-b border-white/5 px-5 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold-300/70">Table chat</p>
      </div>
      <div ref={list} className="scrollbar-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {messages.length === 0 && <p className="pt-6 text-center text-xs text-cream/30">Say hello to the table 👋</p>}
        {messages.map((m) =>
          m.system ? (
            <p key={m.id} className="text-center text-[11px] text-cream/35">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="flex gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/40 text-sm">{m.avatar}</span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gold-200/80">{m.name}</p>
                <p className="break-words text-sm text-cream/80">{m.text}</p>
              </div>
            </div>
          ),
        )}
      </div>
      <form
        className="flex gap-2 border-t border-white/5 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder="Message…"
          className="h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 text-sm outline-none focus:border-gold-400/50"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className={cn("btn-gold h-10 rounded-full px-4 text-sm font-semibold transition disabled:opacity-40")}
        >
          Send
        </button>
      </form>
    </div>
  );
}
