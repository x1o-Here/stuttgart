"use client";

import CreateModal from "@/app/(main)/settings/[...setting]/components/modals/create-modal";
import { useAuth } from "@/contexts/auth-context";
import { useLookupStore } from "@/stores/use-lookup-store";

type QuickAddLookupDialogProps = {
  collectionKey: "departments" | "supplier-types" | "account-types";
  /** Singular label, e.g. "Department". */
  entityLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the new entry's name, e.g. to select it in the field. */
  onCreated: (name: string) => void;
};

/**
 * The settings "add" dialog, opened from a select's "Create new …" item so
 * the user can add a lookup entry without leaving the form they're filling.
 */
export function QuickAddLookupDialog({
  collectionKey,
  entityLabel,
  open,
  onOpenChange,
  onCreated,
}: QuickAddLookupDialogProps) {
  const { activeCompany, user } = useAuth();
  const createItem = useLookupStore((s) => s.createItem);

  return (
    <CreateModal
      entityLabel={entityLabel}
      open={open}
      onOpenChange={onOpenChange}
      onCreated={onCreated}
      onCreate={async (data) => {
        if (!activeCompany || !user) {
          throw new Error("Select a company first.");
        }
        await createItem(activeCompany, user.uid, collectionKey, data);
      }}
    />
  );
}
