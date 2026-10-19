"use client";

import { Check, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "error";
  leaving?: boolean;
}

interface ToastApi {
  /** Show a short confirmation, e.g. toast("Added to cart"). Disappears after 4 seconds. */
  toast: (message: string, tone?: "success" | "error") => void;
}

const Ctx = createContext<ToastApi | null>(null);

/**
 * Mount once (the root layout does). `useToast().toast("Added to cart")` shows a quiet message
 * above the bottom tab bar (phones) or bottom-left (desktop). It is announced politely to screen
 * readers. For results of a form submit prefer the inline status ActionForm already shows.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    // Fade out first, then remove (the fade is skipped by prefers-reduced-motion).
    setItems((all) => all.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((all) => all.filter((t) => t.id !== id)), 140);
  }, []);
  const toast = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      const id = nextId.current++;
      setItems((all) => [...all.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-space)+0.75rem)] z-[60] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-6 lg:left-6 lg:items-start lg:px-0"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              t.leaving ? "toast-out" : "toast-in",
              "pointer-events-auto flex max-w-sm items-center gap-3 rounded-md px-4 py-3 text-sm shadow-md",
              t.tone === "success" ? "bg-ink text-paper" : "bg-vermilion text-paper",
            )}
          >
            {t.tone === "success" && <Check aria-hidden="true" size={16} />}
            <span>{t.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="-mr-2 inline-flex size-8 pointer-coarse:size-11 items-center justify-center rounded-sm hover:bg-paper/15">
              <X aria-hidden="true" size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx>
  );
}

/** Returns `{ toast }`. Outside a ToastProvider it does nothing (safe in tests). */
export function useToast(): ToastApi {
  return useContext(Ctx) ?? { toast: () => {} };
}
