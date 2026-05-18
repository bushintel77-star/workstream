"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  ariaLabel?: string;
};

export function SubmitButton({
  children,
  className,
  pendingLabel,
  formAction,
  ariaLabel,
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      aria-label={ariaLabel}
      formAction={formAction}
    >
      {pending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}
