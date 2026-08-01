"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./ui";

type Props = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  ariaLabel?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "submit" | "button" | "reset";
};

export function SubmitButton({
  children,
  className,
  pendingLabel,
  formAction,
  ariaLabel,
  disabled = false,
  variant = "secondary",
  type = "submit",
}: Props) {
  const { pending } = useFormStatus();
  return (
    <Button
      type={type}
      variant={variant}
      loading={pending}
      disabled={disabled}
      aria-label={ariaLabel}
      formAction={formAction}
      className={className}
    >
      {pending ? pendingLabel ?? children : children}
    </Button>
  );
}
