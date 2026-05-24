"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCatalogSymbolAction } from "../app/actions";
import { useToast } from "./ToastHost";
import { Spinner } from "./Spinner";
import btn from "./submit-button.module.css";
import s from "./designAssetUpload.module.css";

export function CatalogSymbolRemoveButton({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={s.deleteBtn}
      disabled={pending}
      aria-label={`Remove ${label}`}
      onClick={() => {
        if (
          !window.confirm(
            `Remove "${label}" from your library? Built-in Curtis assets are unaffected.`,
          )
        ) {
          return;
        }
        const fd = new FormData();
        fd.set("id", id);
        startTransition(async () => {
          try {
            await deleteCatalogSymbolAction(fd);
            toast.show(`${label} removed`, "success", 3000);
            router.refresh();
          } catch (e) {
            toast.show(
              e instanceof Error ? e.message : "Could not remove asset",
              "error",
              5000,
            );
          }
        });
      }}
    >
      {pending ? (
        <span className={btn.pending}>
          <Spinner size="sm" label="Removing asset" />
          Removing…
        </span>
      ) : (
        "Remove"
      )}
    </button>
  );
}
