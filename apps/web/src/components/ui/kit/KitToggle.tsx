"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import s from "./kit.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  size?: "sm" | "md";
};

/**
 * shadcn/ui-style Toggle. Pressable button that stays "on" when active.
 * Used for toolbar toggles, filter chips, view switches.
 */
export const KitToggle = forwardRef<HTMLButtonElement, Props>(
  function KitToggle(
    {
      active = false,
      size = "md",
      children,
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        data-active={active ? "1" : "0"}
        data-size={size}
        aria-pressed={active}
        className={`${s.toggle} ${className ?? ""}`.trim()}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
