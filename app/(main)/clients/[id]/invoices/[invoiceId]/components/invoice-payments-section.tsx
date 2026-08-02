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
  return (
    <div className="rounded-lg bg-white p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Invoice payments</h2>
        <p className="text-sm text-muted-foreground">
          Log payments against this invoice. When payments cover the full
          amount, outstanding becomes 0 and the invoice is marked complete.
        </p>
      </div>

      {loading ? (
        <LoadingState
          message="Loading payments..."
          variant="skeleton"
          rows={4}
        />
      ) : (
        <InvoicePaymentsTable
          clientId={clientId}
          invoice={invoice}
          payments={payments}
        />
      )}
    </div>
  );
}
