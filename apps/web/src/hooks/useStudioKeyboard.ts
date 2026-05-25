"use client";

import { useEffect } from "react";
import type { ToolOverride } from "../components/studio/studioTypes";

type Handlers = {
  setTool: (t: ToolOverride) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onDelete: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleRightRail: () => void;
  onOpenCommandPalette: () => void;
  onToggleFocusMode: () => void;
  onSelectAll: () => void;
};

export function useStudioKeyboard(handlers: Handlers, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handlers.onOpenCommandPalette();
        return;
      }
      if (mod && e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        if (handlers.canRedo) handlers.onRedo();
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (handlers.canUndo) handlers.onUndo();
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handlers.onSelectAll();
        return;
      }

      if (e.key === "Escape") {
        handlers.onToggleRightRail();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        handlers.onToggleRightRail();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        handlers.onToggleFocusMode();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        handlers.onDelete();
        return;
      }
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        handlers.onZoomIn();
        return;
      }
      if (e.key === "-") {
        e.preventDefault();
        handlers.onZoomOut();
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        handlers.onResetView();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "v") handlers.setTool("select");
      else if (key === "d") handlers.setTool("draw");
      else if (key === "p") handlers.setTool("place");
      else if (key === "m") handlers.setTool("measure");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, handlers]);
}
