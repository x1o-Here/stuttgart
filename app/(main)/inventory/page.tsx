"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { RuledTable, TableCaption } from "@/components/shared/ruled-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useSpareParts } from "@/hooks/use-spare-parts";
import { canEditInventory, isMechanic } from "@/lib/auth/roles";
import type { SparePart, SparePartStatus } from "@/lib/inventory/spare-parts";
import { useLookupStore } from "@/stores/use-lookup-store";
import { AssignPartDialog } from "./components/assign-part-dialog";
import { DeletePartDialog } from "./components/delete-part-dialog";
import { PartDialog } from "./components/part-dialog";

type PartRow = SparePart & { vehicleName: string | null };
type StatusFilter = "active" | SparePartStatus | "all";

const STATUS_META: Record<
  SparePartStatus,
  { label: string; variant: "success" | "brand" | "neutral" }
> = {
  in_stock: { label: "In stock", variant: "success" },
  assigned: { label: "Assigned", variant: "brand" },
  scrapped: { label: "Scrapped", variant: "neutral" },
};

// Search covers part ID and description only.
const searchFilter = (row: Row<PartRow>, _id: string, value: string) => {
  const q = value.trim().toLowerCase();
  if (!q) return true;
  return (
    row.original.partIdKey.includes(q) ||
    row.original.partId.toLowerCase().includes(q) ||
    row.original.description.toLowerCase().includes(q)
  );
};

export default function InventoryPage() {
  const { role } = useAuth();
  const { parts, loading, error } = useSpareParts();
  const vehicles = useLookupStore((s) => s.vehicles);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const canEdit = canEditInventory(role);
  const mechanic = isMechanic(role);

  const rows = useMemo<PartRow[]>(() => {
    const names = new Map(vehicles.map((v) => [v.id, v.name]));
    return parts
      .filter((part) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "active") return part.status !== "scrapped";
        return part.status === statusFilter;
      })
      .map((part) => ({
        ...part,
        vehicleName: part.vehicleId
          ? (names.get(part.vehicleId) ?? "Removed vehicle")
          : null,
      }));
  }, [parts, vehicles, statusFilter]);

  const counts = useMemo(
    () => ({
      inStock: parts.filter((p) => p.status === "in_stock").length,
      assigned: parts.filter((p) => p.status === "assigned").length,
    }),
    [parts],
  );

  const columns = useMemo<ColumnDef<PartRow>[]>(
    () => [
      {
        accessorKey: "partId",
        header: "Part ID",
        size: 150,
        cell: ({ row }) => (
          <TruncatedText className="font-mono font-medium text-foreground">
            {row.original.partId}
          </TruncatedText>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        size: 320,
        cell: ({ row }) => (
          <span className="line-clamp-2 whitespace-normal">
            {row.original.description}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 110,
        cell: ({ row }) => {
          const meta = STATUS_META[row.original.status];
          return <Badge variant={meta.variant}>{meta.label}</Badge>;
        },
      },
      {
        id: "vehicle",
        header: "Assigned to",
        size: 150,
        cell: ({ row }) => {
          const { vehicleId, vehicleName } = row.original;
          if (!vehicleId || !vehicleName) {
            return <span className="text-muted-foreground">–</span>;
          }
          const chip =
            "inline-flex max-w-full items-center gap-1.5 rounded-sm bg-brand-soft px-1.5 py-0.5 font-mono text-xs text-brand";
          return mechanic ? (
            <span className={chip}>
              <span className="truncate">{vehicleName}</span>
            </span>
          ) : (
            <Link
              href={`/fleet/${vehicleId}`}
              className={`${chip} hover:underline`}
            >
              <span className="truncate">{vehicleName}</span>
            </Link>
          );
        },
      },
      {
        id: "createdAt",
        header: "Added",
        size: 110,
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {row.original.createdAt
              ? row.original.createdAt.toLocaleDateString()
              : "–"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        size: canEdit ? 180 : 110,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {row.original.status === "in_stock" && (
              <AssignPartDialog part={row.original} />
            )}
            {canEdit && row.original.status !== "scrapped" && (
              <PartDialog part={row.original} />
            )}
            {canEdit && <DeletePartDialog part={row.original} />}
          </div>
        ),
      },
    ],
    [canEdit, mechanic],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setSearch,
    globalFilterFn: searchFilter,
    state: { globalFilter: search },
  });

  return (
    <div className="flex h-full flex-col divide-y bg-card font-sans">
      <PageHeader
        eyebrow="( Operations · Inventory )"
        lead="Spare parts"
        title="inventory."
        description={
          loading
            ? "Loading parts…"
            : `${counts.inStock} in stock · ${counts.assigned} assigned`
        }
        actions={<PartDialog />}
      />

      {loading ? (
        <div className="p-4">
          <LoadingState
            message="Loading parts..."
            variant="skeleton"
            rows={5}
          />
        </div>
      ) : error ? (
        <p className="m-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col gap-3 px-4 py-3">
            <TableCaption
              label="Parts"
              count={table.getFilteredRowModel().rows.length}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search by part ID or description"
                aria-label="Search parts"
                className="min-w-48 flex-1"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as StatusFilter)
                }
              >
                <SelectTrigger
                  className="w-full bg-card sm:w-44"
                  aria-label="Status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom">
                  <SelectItem value="active">In stock + assigned</SelectItem>
                  <SelectItem value="in_stock">In stock</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="scrapped">Scrapped</SelectItem>
                  <SelectItem value="all">All parts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <RuledTable
            table={table}
            emptyMessage={
              parts.length === 0
                ? "No spare parts yet. Add the first one from the header."
                : "No parts match this search."
            }
          />
        </div>
      )}
    </div>
  );
}
