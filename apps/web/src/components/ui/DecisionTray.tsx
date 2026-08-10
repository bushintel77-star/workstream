"use client";

import { KitButton } from "./kit";
import s from "./ui.module.css";

type Props = {
  onAccept: () => void;
  onRefine: () => void;
  onUndo: () => void;
  acceptLabel?: string;
  refineLabel?: string;
  undoLabel?: string;
  acceptTestId?: string;
  refineTestId?: string;
  undoTestId?: string;
  acceptLoading?: boolean;
  refineLoading?: boolean;
  undoLoading?: boolean;
  disabled?: boolean;
};

export function DecisionTray({
  onAccept,
  onRefine,
  onUndo,
  acceptLabel = "Accept",
  refineLabel = "Refine",
  undoLabel = "Undo",
  acceptTestId,
  refineTestId,
  undoTestId,
  acceptLoading = false,
  refineLoading = false,
  undoLoading = false,
  disabled = false,
}: Props) {
  return (
    <div className={s.decisionTray} role="group" aria-label="Decision">
      <KitButton
        variant="default"
        size="sm"
        onClick={onAccept}
        loading={acceptLoading}
        disabled={disabled || acceptLoading}
        data-testid={acceptTestId}
      >
        {acceptLabel}
      </KitButton>
      <KitButton
        variant="outline"
        size="sm"
        onClick={onRefine}
        loading={refineLoading}
        disabled={disabled || refineLoading}
        data-testid={refineTestId}
      >
        {refineLabel}
      </KitButton>
      <KitButton
        variant="ghost"
        size="sm"
        onClick={onUndo}
        loading={undoLoading}
        disabled={disabled || undoLoading}
        data-testid={undoTestId}
      >
        {undoLabel}
      </KitButton>
    </div>
  );
}
