"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "./ToastHost";

export function SettingsUpgradeToast({
  status,
}: {
  status?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!status) return;
    if (status === "success") {
      toast.show(
        pathname?.includes("/license")
          ? "Design & Build License updated"
          : "Studio plan active — live integrations unlocked",
        "success",
        6000,
      );
    } else if (status === "cancel") {
      toast.show("Checkout cancelled", "error", 4000);
    } else if (status === "dev") {
      toast.show("License updated (development mode)", "success", 5000);
    }
    const clean = pathname?.includes("/license")
      ? "/settings/license"
      : "/settings";
    router.replace(clean);
  }, [status, toast, router, pathname]);

  return null;
}
