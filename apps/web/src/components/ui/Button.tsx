"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import s from "./ui.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    fullWidth = false,
    disabled,
    children,
    className,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      data-variant={variant}
      data-size={size}
      data-fullwidth={fullWidth ? "1" : "0"}
      data-loading={loading ? "1" : "0"}
      className={`${s.btn} ${className ?? ""}`}
      {...rest}
    >
      {loading ? <span className={s.spinner} aria-hidden /> : null}
      {children}
    </button>
  );
});
