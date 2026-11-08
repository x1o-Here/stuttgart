"use client";

import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { completeInvoice } from "@/lib/data/ledger";
import {
  type ClientInvoiceDocument,
  canCompleteInvoice,
  roundMoney,
} from "../../../invoice-model";

type CompleteInvoiceDialogProps = {
  clientId: string;
  invoice: ClientInvoiceDocument;
};

export default function CompleteInvoiceDialog({
  clientId,
  invoice,
}: CompleteInvoiceDialogProps) {
  const { activeCompany, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const canComplete = canCompleteInvoice(
    invoice.totalIncludingVat,
    invoice.outstandingAmount,
    invoice.status,
  );

  async function handleComplete() {
    if (!activeCompany || !user || !canComplete) return;

    try {
      setCompleting(true);
      await completeInvoice({ activeCompany, clientId, invoice, user });
      setOpen(false);
    } catch (error) {
      console.error("Failed to complete invoice", error);
    } finally {
      setCompleting(false);
    }
  }

  if (invoice.status === "paid") {
    return (
      <Button disabled variant="outline">
        Complete
      </Button>
    );
  }

  const money = (value: number) =>
    roundMoney(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(next) => {
        if (!completing) setOpen(next);
      }}
      trigger={<Button disabled={!canComplete}>Complete invoice</Button>}
      eyebrow={`( Complete · Invoice ${invoice.taxInvoiceNo || "–"} )`}
      lead="Complete"
      title="this invoice?"
      description={
        canComplete
          ? `Payments cover the full LKR ${money(invoice.totalIncludingVat)}. Outstanding is set to 0 and the status to Complete.`
          : `Payments must cover the full amount first. Outstanding: LKR ${money(invoice.outstandingAmount)}.`
      }
      confirmLabel={completing ? "Completing…" : "Complete invoice"}
      cancelLabel="Cancel"
      destructive={false}
      pending={completing}
      confirmDisabled={!canComplete}
      keepOpen
      onConfirm={() => void handleComplete()}
    />
  );
}
