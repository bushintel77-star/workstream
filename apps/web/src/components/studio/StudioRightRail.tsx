"use client";

import type { ReactNode } from "react";
import { useStudioChromeOptional } from "./StudioChromeContext";
import rr from "./studioRightRail.module.css";

type Props = {
  children?: ReactNode;
};

export function StudioRightRail({ children }: Props) {
  const chrome = useStudioChromeOptional();
  const open = chrome?.rightRailOpen ?? true;
  const railClass = `${rr.rail} ${open ? rr.railOpen : rr.railClosed}`;

  return (
    <aside className={railClass} aria-label="Library and inspector" data-testid="studio-right-rail">
      <div className={rr.body}>
        {children ?? (
          <p className={rr.placeholder}>Library + inspector — Stage 6</p>
        )}
      </div>
    </aside>
  );
}
