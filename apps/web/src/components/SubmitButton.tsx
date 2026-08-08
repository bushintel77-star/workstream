"use client";

import { useFormStatus } from "react-dom";
import { KitButton } from "./ui/kit";

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
  return (
    <KitButton
      type="submit"
      variant={variant === "ghost" ? "ghost" : "default"}
      loading={pending}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
    >
      {pending ? pendingLabel : children}
    </KitButton>
  );
}
