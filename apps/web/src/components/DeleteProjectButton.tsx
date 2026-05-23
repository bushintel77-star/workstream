"use client";

import { deleteProjectAction } from "../app/actions";
import { SubmitButton } from "./SubmitButton";
import s from "../styles/app.module.css";
import d from "../app/dashboard.module.css";

type Props = {
  projectId: string;
  address: string;
};

export function DeleteProjectButton({ projectId, address }: Props) {
  return (
    <form
      action={deleteProjectAction}
      onSubmit={(e) => {
        if (
          !confirm(
            `Delete "${address}"? This removes the project and cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={projectId} />
      <SubmitButton
        className={`${s.btnDanger} ${d.rowDelete}`}
        pendingLabel="Deleting…"
        ariaLabel={`Delete ${address}`}
      >
        Delete
      </SubmitButton>
    </form>
  );
}
