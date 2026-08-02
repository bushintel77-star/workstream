"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import s from "./kit.module.css";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  size?: "sm" | "md";
};

/**
 * shadcn/ui-style Select. Native <select> with custom styling — clean border,
 * focus ring, subtle shadow. Matches the Figma kit's compact dropdown look.
 */
export const KitSelect = forwardRef<HTMLSelectElement, Props>(
  function KitSelect({ size = "md", className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        data-size={size}
        className={`${s.select} ${className ?? ""}`.trim()}
        {...rest}
      >
        {children}
      </select>
    );
  },
);
