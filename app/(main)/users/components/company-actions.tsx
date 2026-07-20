"use client";

import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { MoreHorizontal, Pencil, Power } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import type { CompanyRecord } from "@/lib/companies/types";
import { db } from "@/lib/firebase/firebase-client";
import { invalidateCompaniesCache } from "./companies-cache";
import CompanyFormDialog from "./company-form-dialog";

type CompanyActionsProps = {
  company: CompanyRecord;
  onChanged?: () => void;
};

export function CompanyActions({ company, onChanged }: CompanyActionsProps) {
  const { user, refreshProfile } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextActive = !company.entityStatus;

  async function handleToggleStatus() {
    if (!user) return;

    try {
      setIsSubmitting(true);
      const batch = writeBatch(db);
      const companyRef = doc(db, "companies", company.id);
      batch.update(companyRef, {
        entityStatus: nextActive,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      const auditLogRef = doc(collection(db, "auditLogs"));
      batch.set(auditLogRef, {
        userId: user.uid,
        action: "update",
        description: `Company ${nextActive ? "activated" : "deactivated"}: ${company.name}`,
        companyId: company.id,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      invalidateCompaniesCache();
      await refreshProfile();
      setStatusOpen(false);
      onChanged?.();
    } catch (error) {
      console.error("Failed to update company status", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setEditOpen(true)}
            className="cursor-pointer"
          >
            <Pencil className="mr-2 h-4 w-4 text-zinc-500" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setStatusOpen(true)}
            className="cursor-pointer"
          >
            <Power className="mr-2 h-4 w-4 text-zinc-500" />
            {company.entityStatus ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CompanyFormDialog
        mode="edit"
        company={company}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={onChanged}
        hideTrigger
      />

      <AlertDialog open={statusOpen} onOpenChange={setStatusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {company.entityStatus
                ? "Deactivate this company?"
                : "Activate this company?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {company.entityStatus
                ? `${company.name} will be marked inactive and hidden from assignment until activated again.`
                : `${company.name} will be marked active again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleToggleStatus();
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
