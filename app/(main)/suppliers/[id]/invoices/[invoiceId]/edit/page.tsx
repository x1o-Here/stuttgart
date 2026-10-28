"use client";

import { useParams } from "next/navigation";
import { LoadingState } from "@/components/shared/loading-state";
import { useSupplier, useSupplierInvoice } from "@/hooks/use-suppliers";
import { SupplierInvoiceForm } from "../../../../components/supplier-invoice-form";

export default function EditSupplierInvoicePage() {
  const { id, invoiceId } = useParams<{ id: string; invoiceId: string }>();
  const { supplier, loading } = useSupplier(id);
  const { invoice, loading: invoiceLoading } = useSupplierInvoice(
    id,
    invoiceId,
  );

  if (loading || invoiceLoading) {
    return (
      <div className="h-full bg-card p-4 font-sans md:p-6">
        <LoadingState
          message="Loading invoice..."
          variant="skeleton"
          rows={6}
        />
      </div>
    );
  }

  if (!supplier || !invoice) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-card p-6 text-center font-sans">
        <span className="eyebrow">( Not found )</span>
        <p className="heading text-2xl">
          <span className="text-muted-foreground">This invoice</span> doesn’t
          exist.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-card font-sans">
      {/* key: reload the form if the stored invoice changes underneath */}
      <SupplierInvoiceForm
        key={invoice.id}
        supplier={supplier}
        invoice={invoice}
      />
    </div>
  );
}
