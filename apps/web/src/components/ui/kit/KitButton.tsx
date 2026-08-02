"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import s from "./kit.module.css";

type Variant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "accent";
type Size = "sm" | "md" | "lg" | "icon";

type Props = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "size"
> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

/**
 * shadcn/ui-style Button. Clean variants, focus ring, subtle shadows.
 * Variants: default (primary), secondary, outline, ghost, destructive, accent.
 * Sizes: sm (32px), md (40px), lg (48px), icon (36px square).
 */
export const KitButton = forwardRef<HTMLButtonElement, Props>(
  function KitButton(
    {
      variant = "secondary",
      size = "md",
      loading = false,
      fullWidth = false,
      children,
      className,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        data-variant={variant}
        data-size={size}
        data-loading={loading ? "1" : "0"}
        data-fullwidth={fullWidth ? "1" : "0"}
        disabled={disabled || loading}
        aria-busy={loading}
        className={`${s.btn} ${className ?? ""}`.trim()}
        {...rest}
      >
        {loading ? <span className={s.btnSpinner} aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
