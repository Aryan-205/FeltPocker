"use client";

import { create } from "zustand";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: "info" | "success" | "error" | "gold";
}

interface ToastState {
  toasts: Toast[];
  push(t: Omit<Toast, "id">): void;
  dismiss(id: number): void;
}

let id = 0;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const toast = { ...t, id: ++id };
    set((s) => ({ toasts: [...s.toasts.slice(-3), toast] }));
    setTimeout(() => get().dismiss(toast.id), 4200);
  },
  dismiss: (tid) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== tid) })),
}));

export const toast = (title: string, body?: string, tone: Toast["tone"] = "info") =>
  useToasts.getState().push({ title, body, tone });
