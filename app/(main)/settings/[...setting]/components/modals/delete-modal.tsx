'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useLookupStore, CollectionKey } from "@/stores/use-lookup-store";
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
} from "@/components/ui/alert-dialog";

interface DeleteModalProps {
  entityLabel: string;
  itemId: string;
  itemName: string;
}

export default function DeleteModal({ entityLabel, itemId, itemName }: DeleteModalProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user, activeCompany } = useAuth();
  const store = useLookupStore();

  const label = entityLabel.toLowerCase();
  const collectionKey: CollectionKey = label === "vehicle" ? "vehicles" : label === "account type" ? "account-types" : "departments";

  const handleDelete = async () => {
    if (!activeCompany || !user) return;
    try {
      setIsDeleting(true);
      await store.deleteItem(activeCompany, user.uid, collectionKey, itemId, itemName);
      setOpen(false);
    } catch (error) {
      console.error(`Failed to delete ${entityLabel.toLowerCase()}`, error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="icon" className="cursor-pointer w-8 h-8 text-destructive hover:bg-destructive/10">
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {entityLabel}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the {entityLabel.toLowerCase()} <strong>{itemName}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90 text-white"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
