"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCrewAction } from "../app/actions";
import { useToast } from "./ToastHost";
import { Button, Dialog } from "./ui";

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
  const [confirmOpen, setConfirmOpen] = useState(false);

  function doRemove() {
    setConfirmOpen(false);
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
  }

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        loading={pending}
        disabled={pending}
        aria-label={`Remove ${name}`}
        onClick={() => setConfirmOpen(true)}
      >
        Remove
      </Button>
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Remove crew member?"
        destructive
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={doRemove}>
              Remove
            </Button>
          </>
        }
      >
        <p>
          Remove <strong>{name}</strong> from crew? This is logged in the
          workspace audit trail.
        </p>
      </Dialog>
    </>
  );
}
