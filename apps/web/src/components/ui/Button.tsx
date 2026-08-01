"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type AnchorHTMLAttributes,
} from "react";
import s from "./ui.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type AsButton = { as?: "button" } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "as" | "variant" | "size" | "loading" | "fullWidth"
>;

type AsAnchor = { as: "a" } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "as" | "variant" | "size" | "loading" | "fullWidth"
>;

type Props = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
} & (AsButton | AsAnchor);

export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  Props
>(function Button(
  {
    as,
    variant = "secondary",
    size = "md",
    loading = false,
    fullWidth = false,
    children,
    className,
    ...rest
  },
  ref,
) {
  const common = {
    "data-variant": variant,
    "data-size": size,
    "data-fullwidth": fullWidth ? "1" : "0",
    "data-loading": loading ? "1" : "0",
    "aria-busy": loading,
    className: `${s.btn} ${className ?? ""}`.trim(),
  };

  if (as === "a") {
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a ref={ref as React.Ref<HTMLAnchorElement>} {...common} {...anchorProps}>
        {loading ? <span className={s.spinner} aria-hidden /> : null}
        {children}
      </a>
    );
  }

  const { type = "button", disabled, ...buttonRest } =
    rest as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      disabled={disabled || loading}
      {...common}
      {...buttonRest}
    >
      {loading ? <span className={s.spinner} aria-hidden /> : null}
      {children}
    </button>
  );
});
