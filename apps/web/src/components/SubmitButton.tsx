"use client";

import { useFormStatus } from "react-dom";
import s from "../styles/app.module.css";

type Props = {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: Props) {
  const { pending } = useFormStatus();
  const cls =
    variant === "ghost"
      ? `${s.btnGhost} ${className ?? ""}`
      : `${s.btn} ${className ?? ""}`;
  return (
    <button
      type="submit"
      className={cls.trim()}
      disabled={pending || disabled}
      aria-label={ariaLabel}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
