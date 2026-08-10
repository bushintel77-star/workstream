"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import s from "./kit.module.css";

/**
 * `size` is omitted from the native attributes before being redeclared: the DOM
 * `size` is a row count (number), so intersecting it with the variant union
 * collapsed to `never` and made `size="sm"` unusable despite the stylesheet
 * shipping it. Same shape as KitButton.
 */
type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
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
