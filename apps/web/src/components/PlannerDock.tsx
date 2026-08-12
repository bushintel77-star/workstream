"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { RailDrawer } from "./RailDrawer";
import { BottomDock } from "./BottomDock";

const DESKTOP_MEDIA_QUERY = "(min-width: 769px)";

function subscribeToViewport(callback: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

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
  const isDesktop = useSyncExternalStore(
    subscribeToViewport,
    getDesktopSnapshot,
    () => true,
  );

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
