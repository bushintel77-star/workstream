"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ToastKind = "info" | "success" | "error";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  ttlMs: number;
};

type ToastContextValue = {
  show: (message: string, kind?: ToastKind, ttlMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = "info", ttlMs = 4000) => {
      const id = nextId++;
      setToasts((cur) => [...cur, { id, kind, message, ttlMs }]);
      const timer = setTimeout(() => dismiss(id), ttlMs);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live={toasts.some((t) => t.kind === "error") ? "assertive" : "polite"}
        aria-atomic="true"
        style={{
          position: "fixed",
          bottom: "calc(16px + env(safe-area-inset-bottom))",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          pointerEvents: "none",
          zIndex: 1000,
          padding: "0 16px",
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const palette = {
    info: { bg: "#18181B", fg: "#FAFAF7" },
    success: { bg: "#15803D", fg: "#FFFFFF" },
    error: { bg: "#B91C1C", fg: "#FFFFFF" },
  }[toast.kind];

  return (
    <button
      type="button"
      onClick={onDismiss}
      style={{
        pointerEvents: "auto",
        background: palette.bg,
        color: palette.fg,
        border: "none",
        borderRadius: 10,
        padding: "12px 18px",
        fontSize: 14,
        fontWeight: 500,
        boxShadow: "0 8px 24px rgba(24,24,27,0.15)",
        maxWidth: 480,
        cursor: "pointer",
        fontFamily: "inherit",
        animation: "toastIn 200ms ease-out",
      }}
    >
      {toast.message}
    </button>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    /* During initial render before the provider mounts, fall back to a
     * silent shim rather than throwing. Lets server components hand a
     * page off without crashing on hydration. */
    return {
      show: () => {
        /* no-op */
      },
    };
  }
  return ctx;
}
