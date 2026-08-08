"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./toast-host.module.css";

type ToastKind = "info" | "success" | "error";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  ttlMs: number;
  action?: ToastAction;
};

type ShowOptions = {
  action?: ToastAction;
};

type ToastContextValue = {
  show: (
    message: string,
    kind?: ToastKind,
    ttlMs?: number,
    options?: ShowOptions,
  ) => void;
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
    (
      message: string,
      kind: ToastKind = "info",
      ttlMs = 4000,
      options?: ShowOptions,
    ) => {
      const id = nextId++;
      setToasts((cur) => [
        ...cur,
        { id, kind, message, ttlMs, action: options?.action },
      ]);
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

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live={toasts.some((t) => t.kind === "error") ? "assertive" : "polite"}
        aria-atomic="true"
        className={styles.host}
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
  return (
    <div className={`${styles.toast} ${styles[toast.kind]}`}>
      <button type="button" className={styles.messageBtn} onClick={onDismiss}>
        {toast.message}
      </button>
      {toast.action ? (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
    </div>
  );
}

const NOOP_TOAST: ToastContextValue = {
  show: () => {
    /* no-op outside ToastHost */
  },
};

export function useToast() {
  return useContext(ToastContext) ?? NOOP_TOAST;
}
