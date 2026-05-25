"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";

type Props = {
  children: ReactNode;
  desktop: ReactNode;
};

/** Workflow 1 desktop shell at ≥960px or ?studio=desktop. */
export function StudioDesktopGate({ children, desktop }: Props) {
  const wide = useMediaQuery("(min-width: 960px)");
  const params = useSearchParams();
  const forceDesktop = params.get("studio") === "desktop";
  if (wide || forceDesktop) {
    return <>{desktop}</>;
  }
  return <>{children}</>;
}
