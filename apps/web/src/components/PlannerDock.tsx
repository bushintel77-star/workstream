"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RailDrawer } from "./RailDrawer";
import { BottomDock } from "./BottomDock";

/**
 * PlannerDock — renders the planner content in the correct drawer for the
 * current viewport. Desktop gets the right-edge RailDrawer, mobile gets the
 * bottom-edge BottomDock. Only one is mounted at a time — no duplicated
 * content, no duplicated API calls.
 */
export function PlannerDock({
  children,
  label = "Planner",
  accent = "blue",
}: {
  children: ReactNode;
  label?: string;
  accent?: "blue" | "red" | "green" | "yellow";
}) {
  // Hydrate with the desktop drawer first so the server and client render the
  // same tree; then swap to the mobile dock after mount if needed.
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 769px)");
    function onChange(e: MediaQueryListEvent) {
      setIsDesktop(e.matches);
    }
    setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (isDesktop) {
    return (
      <RailDrawer label={label} accent={accent} width={420}>
        {children}
      </RailDrawer>
    );
  }

  return (
    <BottomDock label={label} accent={accent}>
      {children}
    </BottomDock>
  );
}
