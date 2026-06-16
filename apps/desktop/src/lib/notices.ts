import { create } from "zustand";

/**
 * Transient success / info notices — positive feedback for actions like "settings saved".
 * Separate from the error-toast catalog (which is code-driven); these are ephemeral messages.
 */
export type NoticeTone = "success" | "info";

export interface Notice {
  id: number;
  message: string;
  tone: NoticeTone;
}

interface NoticeState {
  notices: Notice[];
  notify: (message: string, tone?: NoticeTone) => void;
  dismiss: (id: number) => void;
}

const DURATION_MS = 2600;
const MAX = 3;
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useNotices = create<NoticeState>((set, get) => ({
  notices: [],
  notify: (message, tone = "success") => {
    const id = nextId++;
    set((state) => ({ notices: [...state.notices.slice(-(MAX - 1)), { id, message, tone }] }));
    timers.set(
      id,
      setTimeout(() => get().dismiss(id), DURATION_MS),
    );
  },
  dismiss: (id) => {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) }));
  },
}));

/** Imperative helper for non-component callers (stores, handlers). */
export function notify(message: string, tone?: NoticeTone): void {
  useNotices.getState().notify(message, tone);
}
