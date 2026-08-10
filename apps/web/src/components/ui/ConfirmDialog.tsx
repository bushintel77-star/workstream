"use client";

import { type ReactNode } from "react";
import { Dialog } from "./Dialog";
import { KitButton } from "./kit";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmLoading?: boolean;
  confirmTestId?: string;
  disabled?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  confirmLoading = false,
  confirmTestId,
  disabled = false,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      destructive={destructive}
      footer={
        <>
          <KitButton
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={confirmLoading}
          >
            {cancelLabel}
          </KitButton>
          <KitButton
            variant={destructive ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
            loading={confirmLoading}
            disabled={disabled}
            data-testid={confirmTestId}
          >
            {confirmLabel}
          </KitButton>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
