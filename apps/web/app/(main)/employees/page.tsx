"use client";
// TanStack Table returns a stable table object, so the React Compiler would
// keep rendering stale rows when the data changes. Opt this file out.
"use no memo";

import {
  type ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { RuledTable, TableCaption } from "@/components/shared/ruled-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { employeeAccountName } from "@/lib/constants/client-account";
import { type Employee, useEmployees } from "@/lib/data/employees";
import { EmployeeDialog } from "./components/employee-dialog";

const searchFilter = (row: Row<Employee>, _id: string, value: string) => {
  const q = value.trim().toLowerCase();
  if (!q) return true;
  const { employeeNo, name, role } = row.original;
  return [employeeNo, name, role].some((v) => v.toLowerCase().includes(q));
};

const columns: ColumnDef<Employee>[] = [
  {
    accessorKey: "employeeNo",
    header: "Emp. No",
    size: 120,
    cell: ({ row }) => (
      <TruncatedText className="font-mono font-medium text-foreground">
        {row.original.employeeNo}
      </TruncatedText>
    ),
  },
  {
    accessorKey: "name",
    header: "Name",
    size: 240,
    cell: ({ row }) => (
      <TruncatedText className="font-medium text-foreground">
        {row.original.name}
      </TruncatedText>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    size: 180,
    cell: ({ row }) => <TruncatedText>{row.original.role}</TruncatedText>,
  },
  {
    id: "account",
    header: "Account",
    size: 220,
    cell: ({ row }) => (
      <TruncatedText className="font-mono text-xs text-muted-foreground">
        {employeeAccountName(row.original.name)}
      </TruncatedText>
    ),
  },
  {
    id: "createdAt",
    header: "Added",
    size: 110,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {new Date(row.original.createdAt).toLocaleDateString()}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    size: 70,
    cell: ({ row }) => (
      <div className="flex items-center justify-end">
        <EmployeeDialog employee={row.original} />
      </div>
    ),
  },
];

export default function EmployeesPage() {
  const { activeCompany } = useAuth();
  const { data, isError } = useEmployees(activeCompany);
  const loading = data === undefined && !isError;
  const employees = useMemo(() => data ?? [], [data]);
  const [search, setSearch] = useState("");

  const table = useReactTable({
    data: employees,
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
        eyebrow="( People · Employees )"
        lead="Employees and"
        title="their accounts."
        description={
          loading
            ? "Loading employees…"
            : `${employees.length} employee${employees.length === 1 ? "" : "s"}`
        }
        actions={<EmployeeDialog />}
      />

      {loading ? (
        <div className="p-4">
          <LoadingState
            message="Loading employees..."
            variant="skeleton"
            rows={5}
          />
        </div>
      ) : isError ? (
        <p className="m-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
          Couldn’t load employees. Please try again.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-col gap-3 px-4 py-3">
            <TableCaption
              label="Employees"
              count={table.getFilteredRowModel().rows.length}
            />
            <Input
              placeholder="Search by number, name or role"
              aria-label="Search employees"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <RuledTable
            table={table}
            emptyMessage={
              employees.length === 0
                ? "No employees yet. Add the first one from the header."
                : "No employees match this search."
            }
          />
        </div>
      )}
    </div>
  );
}
