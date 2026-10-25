"use client";

import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { MoreHorizontal, Pencil, Power } from "lucide-react";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
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
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${company.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuItem
            variant={company.entityStatus ? "destructive" : "default"}
            onClick={() => setStatusOpen(true)}
          >
            <Power />
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

      <ConfirmationDialog
        open={statusOpen}
        onOpenChange={(next) => {
          if (!isSubmitting) setStatusOpen(next);
        }}
        eyebrow={`( Company status · ${company.entityStatus ? "Active" : "Inactive"} )`}
        lead={company.entityStatus ? "Deactivate" : "Activate"}
        title={`${company.name}?`}
        description={
          company.entityStatus
            ? "The company is marked inactive and can’t be assigned to users until it’s activated again. Its data stays as it is."
            : "The company is marked active again and can be assigned to users."
        }
        confirmLabel={
          isSubmitting
            ? "Updating…"
            : company.entityStatus
              ? "Deactivate company"
              : "Activate company"
        }
        cancelLabel="Cancel"
        destructive={company.entityStatus}
        pending={isSubmitting}
        keepOpen
        onConfirm={() => void handleToggleStatus()}
      />
    </>
  );
}
