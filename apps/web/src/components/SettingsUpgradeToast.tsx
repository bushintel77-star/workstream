"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./ToastHost";

export function SettingsUpgradeToast({
  status,
}: {
  status?: string;
}) {
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!status) return;
    if (status === "success") {
      toast.show("Studio plan active — live integrations unlocked", "success", 6000);
    } else if (status === "cancel") {
      toast.show("Checkout cancelled", "error", 4000);
    } else if (status === "dev") {
      toast.show("Studio enabled (development mode)", "success", 5000);
    }
    router.replace("/settings");
  }, [status, toast, router]);

  return null;
}
