"use client";

import type { ReactNode } from "react";
import { useStudioChromeOptional } from "./StudioChromeContext";
import type { RightRailTab } from "./studioTypes";
import rr from "./studioRightRail.module.css";

type Props = {
  children?: ReactNode;
  activeTab: RightRailTab;
  onTab: (tab: RightRailTab) => void;
};

const TABS: [RightRailTab, string][] = [
  ["inspector", "Inspector"],
  ["layers", "Layers"],
  ["library", "Library"],
  ["schedule", "Schedule"],
];

export function StudioRightRail({ children, activeTab, onTab }: Props) {
  const chrome = useStudioChromeOptional();
  const open = chrome?.rightRailOpen ?? true;
  const railClass = `${rr.rail} ${open ? rr.railOpen : rr.railClosed}`;

  return (
    <aside className={railClass} aria-label="Library and inspector" data-testid="studio-right-rail">
      <header className={rr.header}>
        <span className={rr.headerTitle}>{activeTab}</span>
        <button
          type="button"
          className={rr.close}
          aria-label="Close panel"
          onClick={() => chrome?.setRightRailOpen(false)}
        >
          ×
        </button>
      </header>
      <div className={rr.tabs} role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`${rr.tab} ${activeTab === id ? rr.tabActive : ""}`}
            onClick={() => onTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={rr.body} role="tabpanel">
        {children ?? (
          <p className={rr.placeholder}>Select a symbol on canvas to inspect, or open Library.</p>
        )}
      </div>
    </aside>
  );
}
