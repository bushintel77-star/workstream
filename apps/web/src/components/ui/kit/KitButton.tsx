"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type AnchorHTMLAttributes,
  type Ref,
} from "react";
import s from "./kit.module.css";

type Variant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "accent";
type Size = "sm" | "md" | "lg" | "icon";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

type AsButton = CommonProps & { as?: "button" } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "size"
>;
type AsAnchor = CommonProps & { as: "a" } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "size"
>;
type Props = AsButton | AsAnchor;

/**
 * shadcn/ui-style Button — the single canonical button for the app.
 * Renders a <button> by default, or an <a> with as="a" for link CTAs.
 * Variants: default (primary), secondary, outline, ghost, destructive, accent.
 * Sizes: sm (32px), md (40px), lg (48px), icon (36px square).
 */
export const KitButton = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  Props
>(function KitButton(props, ref) {
  const {
    variant = "secondary",
    size = "md",
    loading = false,
    fullWidth = false,
    children,
    className,
    ...rest
  } = props;

  const common = {
    "data-variant": variant,
    "data-size": size,
    "data-loading": loading ? "1" : "0",
    "data-fullwidth": fullWidth ? "1" : "0",
    "aria-busy": loading,
    className: `${s.btn} ${className ?? ""}`.trim(),
  };

  if (props.as === "a") {
    const { as: _as, ...anchorRest } =
      rest as AnchorHTMLAttributes<HTMLAnchorElement> & { as?: "a" };
    return (
      <a ref={ref as Ref<HTMLAnchorElement>} {...common} {...anchorRest}>
        {loading ? <span className={s.btnSpinner} aria-hidden /> : null}
        {children}
      </a>
    );
  }

  const {
    as: _as,
    type = "button",
    disabled,
    ...buttonRest
  } = rest as ButtonHTMLAttributes<HTMLButtonElement> & { as?: "button" };
  return (
    <button
      ref={ref as Ref<HTMLButtonElement>}
      type={type}
      disabled={disabled || loading}
      {...common}
      {...buttonRest}
    >
      {loading ? <span className={s.btnSpinner} aria-hidden /> : null}
      {children}
    </button>
  );
});
