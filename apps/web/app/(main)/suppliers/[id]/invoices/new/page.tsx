"use client";

import { useParams } from "next/navigation";
import { LoadingState } from "@/components/shared/loading-state";
import { useSupplier } from "@/hooks/use-suppliers";
import { SupplierInvoiceForm } from "../../../components/supplier-invoice-form";

export default function NewSupplierInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { supplier, loading } = useSupplier(id);

  if (loading) {
    return (
      <div className="h-full bg-card p-4 font-sans md:p-6">
        <LoadingState
          message="Loading supplier..."
          variant="skeleton"
          rows={6}
        />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-card p-6 text-center font-sans">
        <span className="eyebrow">( Not found )</span>
        <p className="heading text-2xl">
          <span className="text-muted-foreground">This supplier</span> could not
          be found.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-card font-sans">
      <SupplierInvoiceForm supplier={supplier} />
    </div>
  );
}
