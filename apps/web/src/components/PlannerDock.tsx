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
 *
 * useSyncExternalStore subscribes to the viewport media query without a
 * setState-in-effect. The server snapshot is `true` (desktop) so SSR renders
 * RailDrawer; the client snapshot reads the real matchMedia after hydration
 * and React re-renders if they disagree — no hydration mismatch warning.
 */
const DESKTOP_QUERY = "(min-width: 769px)";

function subscribeDesktop(callback: () => void): () => void {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getDesktopSnapshot(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getDesktopServerSnapshot(): boolean {
  return true;
}

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
    subscribeDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
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
