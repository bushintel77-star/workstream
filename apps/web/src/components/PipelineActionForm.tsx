"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import s from "../styles/app.module.css";
import { SubmitButton } from "./SubmitButton";
import { useToast } from "./ToastHost";

type Props = {
  projectId: string;
  action: (formData: FormData) => Promise<void>;
  label: string;
  pendingLabel: string;
  successMessage: string;
  className?: string;
  accent?: boolean;
  kind?: string;
  redirectToProcessing?: boolean;
  disabled?: boolean;
};

export function PipelineActionForm({
  projectId,
  action,
  label,
  pendingLabel,
  successMessage,
  className,
  accent = false,
  kind,
  redirectToProcessing = false,
  disabled = false,
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          try {
            await action(fd);
            toast.show(successMessage, "success", 3500);
            if (redirectToProcessing) {
              router.push(`/projects/${projectId}/processing`);
              return;
            }
            router.refresh();
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : "Something went wrong";
            toast.show(msg, "error", 6000);
          }
        });
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      {kind && <input type="hidden" name="kind" value={kind} />}
      <SubmitButton
        className={[s.btn, accent ? s.btnAccent : "", className]
          .filter(Boolean)
          .join(" ")}
        pendingLabel={pendingLabel}
        disabled={pending || disabled}
      >
        {label}
      </SubmitButton>
    </form>
  );
}
