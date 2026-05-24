"use client";

import { createOverrideAction } from "../app/actions";
import { SubmitButton } from "./SubmitButton";
import s from "../styles/app.module.css";
import p from "../app/projects/[id]/project.module.css";

export function AuditOverrideForm({
  projectId,
  findingIndex,
}: {
  projectId: string;
  findingIndex: number;
}) {
  return (
    <form
      action={createOverrideAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Record this override permanently? It stays in the project ledger and cannot be undone.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="finding_index" value={findingIndex} />
      <textarea
        name="reason"
        className={s.textarea}
        placeholder="Why is this finding acceptable? Minimum 8 characters. This is recorded forever in the project ledger."
        minLength={8}
        required
        rows={3}
        aria-label={`Override reason for finding ${findingIndex + 1}`}
      />
      <div className={p.overrideActions}>
        <SubmitButton className={s.btnDanger} pendingLabel="Recording…">
          Record override
        </SubmitButton>
      </div>
    </form>
  );
}
