"use client";

import { LoadingState } from "@/components/shared/loading-state";
import type {
  ClientInvoiceDocument,
  InvoicePayment,
} from "../../../invoice-model";
import InvoicePaymentsTable from "./invoice-payments-table";

type InvoicePaymentsSectionProps = {
  clientId: string;
  invoice: ClientInvoiceDocument;
  payments: InvoicePayment[];
  loading?: boolean;
};

export default function InvoicePaymentsSection({
  clientId,
  invoice,
  payments,
  loading = false,
}: InvoicePaymentsSectionProps) {
  if (loading) {
    return (
      <div className="p-4">
        <LoadingState
          message="Loading payments..."
          variant="skeleton"
          rows={4}
        />
      </div>
    );
  }

  return (
    <InvoicePaymentsTable
      clientId={clientId}
      invoice={invoice}
      payments={payments}
    />
  );
}
