"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCrewAction } from "../app/actions";
import s from "../styles/app.module.css";
import btn from "./submit-button.module.css";
import { Spinner } from "./Spinner";
import { useToast } from "./ToastHost";

export function CrewRemoveButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={s.btnDanger}
      disabled={pending}
      aria-label={`Remove ${name}`}
      onClick={() => {
        if (
          !window.confirm(
            `Remove ${name} from crew? This is logged in the workspace audit trail.`,
          )
        ) {
          return;
        }
        const fd = new FormData();
        fd.set("id", id);
        startTransition(async () => {
          try {
            await deleteCrewAction(fd);
            toast.show(`${name} removed`, "success", 3000);
            router.refresh();
          } catch (e) {
            toast.show(
              e instanceof Error ? e.message : "Could not remove crew member",
              "error",
              5000,
            );
          }
        });
      }}
    >
      {pending ? (
        <span className={btn.pending}>
          <Spinner size="sm" label="Removing crew member" />
          Removing…
        </span>
      ) : (
        "Remove"
      )}
    </button>
  );
}
