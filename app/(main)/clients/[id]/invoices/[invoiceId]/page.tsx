"use client";

import { ChevronLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ClientInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = typeof params.id === "string" ? params.id : undefined;
  // Nested [id] under invoices — Next may expose as params from parent+child;
  // for app/(main)/clients/[id]/invoices/[id], both segments are named "id"
  // which collides. Check both common shapes.
  const invoiceId =
    typeof (params as Record<string, string | string[]>).invoiceId === "string"
      ? ((params as Record<string, string>).invoiceId as string)
      : Array.isArray(params.id)
        ? params.id[1]
        : undefined;

  const resolvedClientId = Array.isArray(params.id) ? params.id[0] : clientId;

  return (
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full flex flex-col gap-4 p-4 bg-zinc-100 rounded-lg min-h-0 overflow-y-auto">
        <Button
          size="sm"
          variant="ghost"
          className="cursor-pointer hover:bg-gray-100 w-fit px-1"
          onClick={() =>
            router.push(resolvedClientId ? `/clients/${resolvedClientId}` : "/clients")
          }
        >
          <ChevronLeft />
          Back
        </Button>

        <div className="p-4 bg-white rounded-lg flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Invoice</h1>
          <p className="text-sm text-muted-foreground">
            Invoice ID: {invoiceId || "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            Client ID: {resolvedClientId || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
