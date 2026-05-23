"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { deleteProjectAction } from "../app/actions";
import { useToast } from "./ToastHost";
import s from "../styles/app.module.css";
import d from "../app/dashboard.module.css";

const UNDO_MS = 5000;

type Props = {
  projectId: string;
  address: string;
  statusPill: string;
  statusLabel: string;
  createdLabel: string;
};

export function DashboardProjectRow({
  projectId,
  address,
  statusPill,
  statusLabel,
  createdLabel,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelPendingDelete() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPendingDelete(false);
  }

  function requestDelete() {
    if (
      !confirm(
        `Delete "${address}"? You can undo for ${UNDO_MS / 1000} seconds.`,
      )
    ) {
      return;
    }

    setPendingDelete(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void (async () => {
        try {
          const fd = new FormData();
          fd.set("id", projectId);
          await deleteProjectAction(fd);
          router.refresh();
        } catch (err) {
          setPendingDelete(false);
          toast.show(
            err instanceof Error ? err.message : "Delete failed",
            "error",
          );
        }
      })();
    }, UNDO_MS);

    toast.show(`Deleted "${address}"`, "info", UNDO_MS, {
      action: {
        label: "Undo",
        onClick: cancelPendingDelete,
      },
    });
  }

  if (pendingDelete) {
    return null;
  }

  return (
    <li className={`${s.card} ${d.row}`}>
      <Link href={`/projects/${projectId}`} className={d.rowLink}>
        <span className={d.rowAddress}>{address}</span>
        <span className={`${s.brandSub} ${d.rowMeta}`}>
          <span className={`${s.pill} ${statusPill}`}>{statusLabel}</span>
          <span>{createdLabel}</span>
        </span>
      </Link>
      <button
        type="button"
        className={`${s.btnDanger} ${d.rowDelete}`}
        aria-label={`Delete ${address}`}
        onClick={requestDelete}
      >
        Delete
      </button>
    </li>
  );
}
