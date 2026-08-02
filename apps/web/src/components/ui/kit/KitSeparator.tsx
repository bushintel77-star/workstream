"use client";

import s from "./kit.module.css";

type Orientation = "horizontal" | "vertical";

type Props = {
  orientation?: Orientation;
  className?: string;
};

/**
 * shadcn/ui-style Separator. Thin hairline divider — horizontal or vertical.
 */
export function KitSeparator({ orientation = "horizontal", className }: Props) {
  return (
    <div
      data-orientation={orientation}
      className={`${s.separator} ${className ?? ""}`.trim()}
      role="separator"
    />
  );
}
