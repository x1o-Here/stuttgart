import type * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { buttonVariants } from "../ui/button";

type ConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** Mono label above the title. */
  eyebrow?: React.ReactNode;
  /** Muted lead phrase of the two-tone title. */
  lead?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm action as destructive (delete, discard). */
  destructive?: boolean;
  pending?: boolean;
  /** Optional trigger element (rendered via AlertDialogTrigger asChild). */
  trigger?: React.ReactNode;
  /** Optional body between the header and footer (details, fields). */
  children?: React.ReactNode;
  /**
   * Keep the dialog open after confirm so the caller can close it when an
   * async action finishes.
   */
  keepOpen?: boolean;
  /** Disables only the confirm action (e.g. preconditions not met). */
  confirmDisabled?: boolean;
};

export default function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  eyebrow = "( Unsaved changes )",
  lead = "Discard",
  title = "your changes?",
  description = "You have unsaved changes. Closing now will discard them.",
  confirmLabel = "Discard",
  cancelLabel = "Keep editing",
  destructive = true,
  pending = false,
  trigger,
  children,
  keepOpen = false,
  confirmDisabled = false,
}: ConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent className="gap-0 p-0 sm:max-w-md">
        <AlertDialogHeader className="gap-3 px-6 pt-6 pb-5 text-left">
          <span className="eyebrow">{eyebrow}</span>
          <AlertDialogTitle className="heading text-2xl font-normal">
            {lead && <span className="text-muted-foreground">{lead}</span>}{" "}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {children && <div className="border-t px-6 py-5">{children}</div>}

        <AlertDialogFooter className="border-t bg-surface-muted px-6 py-4">
          <AlertDialogCancel
            className={buttonVariants({ variant: "ghost" })}
            disabled={pending}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({
              variant: destructive ? "destructive" : "default",
            })}
            disabled={pending || confirmDisabled}
            onClick={(event) => {
              if (keepOpen) event.preventDefault();
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
