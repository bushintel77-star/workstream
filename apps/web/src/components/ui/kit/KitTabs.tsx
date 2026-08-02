"use client";

import { type ReactNode } from "react";
import s from "./kit.module.css";

type Tab = {
  value: string;
  label: ReactNode;
  /** Optional badge count (e.g. page number). */
  badge?: number;
};

type Props = {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

/**
 * shadcn/ui-style Tabs. Inline pill group with an animated active indicator.
 * Used for page navigation in the Present workspace.
 */
export function KitTabs({ tabs, value, onChange, className }: Props) {
  return (
    <div className={`${s.tabs} ${className ?? ""}`.trim()} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          data-active={tab.value === value ? "1" : "0"}
          className={s.tab}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.badge != null ? (
            <span className={s.tabBadge}>{tab.badge}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
