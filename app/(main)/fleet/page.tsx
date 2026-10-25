"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { RuledTable, TableCaption } from "@/components/shared/ruled-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Input } from "@/components/ui/input";
import { useLookupStore } from "@/stores/use-lookup-store";
import DeleteModal from "../settings/[...setting]/components/modals/delete-modal";
import VehicleFormDialog, {
  type VehicleRow,
} from "./components/vehicle-form-dialog";

const columns: ColumnDef<VehicleRow>[] = [
  {
    id: "index",
    header: "No",
    size: 56,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {String(row.index + 1).padStart(2, "0")}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: "Vehicle number",
    size: 180,
    meta: { globalFilter: true },
    cell: ({ row }) => (
      <TruncatedText className="font-mono font-medium text-foreground">
        {row.original.name}
      </TruncatedText>
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    size: 400,
    cell: ({ row }) => (
      <TruncatedText
        className={
          row.original.description ? undefined : "text-muted-foreground"
        }
      >
        {row.original.description || "–"}
      </TruncatedText>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    size: 120,
    cell: ({ row }) => (
      // Dialogs portal out but React events still bubble: keep row clicks out.
      // biome-ignore lint/a11y/noStaticElementInteractions: event boundary only
      // biome-ignore lint/a11y/useKeyWithClickEvents: event boundary only
      <div
        className="flex items-center justify-end gap-0.5"
        onClick={(event) => event.stopPropagation()}
      >
        <VehicleFormDialog vehicle={row.original} />
        <DeleteModal
          entityLabel="Vehicle"
          itemId={row.original.id}
          itemName={row.original.name}
        />
        <Link
          href={`/fleet/${row.original.id}`}
          aria-label={`Open ${row.original.name}`}
          className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    ),
  },
];

export default function FleetPage() {
  const router = useRouter();
  const vehicles = useLookupStore((s) => s.vehicles);
  const isLoading = useLookupStore((s) => s.loading.vehicles);
  const [globalFilter, setGlobalFilter] = useState("");

  const data = useMemo<VehicleRow[]>(
    () =>
      vehicles.map(({ id, name, description }) => ({
        id,
        name,
        description: description ?? "",
      })),
    [vehicles],
  );

  const table = useReactTable({
    defaultColumn: {
      cell: ({ getValue }) => (
        <TruncatedText>{String(getValue() ?? "")}</TruncatedText>
      ),
    },
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: { globalFilter },
  });

  return (
    <div className="flex h-full flex-col divide-y bg-card font-sans">
      <PageHeader
        eyebrow="( Operations · Fleet )"
        lead="Fleet"
        title="register."
        description={
          isLoading
            ? "Loading vehicles…"
            : `${data.length} ${data.length === 1 ? "vehicle" : "vehicles"}`
        }
        actions={<VehicleFormDialog />}
      />

      {isLoading ? (
        <div className="p-4">
          <LoadingState
            message="Loading vehicles..."
            variant="skeleton"
            rows={5}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col gap-3 px-4 py-3">
            <TableCaption
              label="Vehicles"
              count={table.getFilteredRowModel().rows.length}
            />
            <Input
              placeholder="Search by vehicle number or description"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>
          <RuledTable
            table={table}
            emptyMessage={
              data.length
                ? "No vehicles match this search."
                : "No vehicles yet. Add the first one from the header."
            }
            onRowClick={(vehicle) => router.push(`/fleet/${vehicle.id}`)}
          />
        </div>
      )}
    </div>
  );
}
