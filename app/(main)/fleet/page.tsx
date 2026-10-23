"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLookupStore } from "@/stores/use-lookup-store";
import DeleteModal from "../settings/[...setting]/components/modals/delete-modal";
import VehicleFormDialog, {
  type VehicleRow,
} from "./components/vehicle-form-dialog";

const columns: ColumnDef<VehicleRow>[] = [
  {
    id: "index",
    header: "#",
    size: 50,
    cell: ({ row }) => row.index + 1,
  },
  {
    accessorKey: "name",
    header: "Vehicle Number",
    size: 200,
    meta: { globalFilter: true },
  },
  {
    accessorKey: "description",
    header: "Description",
    size: 400,
  },
  {
    id: "actions",
    header: "Actions",
    size: 100,
    cell: ({ row }) => (
      <div className="flex gap-2 items-center">
        <VehicleFormDialog vehicle={row.original} />
        <DeleteModal
          entityLabel="Vehicle"
          itemId={row.original.id}
          itemName={row.original.name}
        />
      </div>
    ),
  },
];

export default function FleetPage() {
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
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full flex flex-col gap-4 p-4 bg-zinc-100 rounded-lg overflow-y-auto">
        <h1 className="text-2xl font-bold mb-4">Fleet</h1>

        <div className="w-full p-4 rounded-md bg-white flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <Input
              placeholder="Search by vehicle number or description"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />
            <VehicleFormDialog />
          </div>

          {isLoading ? (
            <LoadingState
              message="Loading vehicles..."
              variant="skeleton"
              rows={5}
            />
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table className="table-fixed w-full">
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className="overflow-hidden"
                          style={{ width: header.getSize() }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className="overflow-hidden"
                            style={{ width: cell.column.getSize() }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No vehicles found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
