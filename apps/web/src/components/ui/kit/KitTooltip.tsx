"use client";

import { type ReactNode } from "react";
import s from "./kit.module.css";

type Props = {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
};

/**
 * shadcn/ui-style Tooltip. Pure CSS hover/focus tooltip — no JS positioning.
 * Wraps a trigger element and shows the label on hover/focus.
 */
export function KitTooltip({ label, children, side = "top" }: Props) {
  return (
    <span className={s.tooltipRoot} data-side={side}>
      {children}
      <span className={s.tooltipContent} role="tooltip">
        {label}
      </span>
    </span>
  );
}
