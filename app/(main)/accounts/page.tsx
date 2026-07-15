"use client";

import { useRouter } from "next/navigation";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import AddAccountDialog from "./components/add-account-dialog";
import { ColumnFiltersState, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { accountsColumns } from "./components/accounts-columns";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLookupStore } from "@/stores/use-lookup-store";
import { useAuth } from "@/contexts/auth-context";

export default function AccountsPage() {
  const { accounts } = useAccountsContext();
  const { user, activeCompany } = useAuth();
  const router = useRouter();

  const store = useLookupStore();
  const { accountTypes } = store;

  useEffect(() => {
    if (!activeCompany || !user) return;
    return store.subscribeAll(activeCompany, user.uid);
  }, [activeCompany, user, store]);

  const columns = useMemo(() => accountsColumns, []);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: accounts,
    columns,

    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),

    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,

    state: {
      globalFilter,
      columnFilters,
    },
  })

  return (
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full space-y-8 p-4 bg-zinc-100 rounded-lg overflow-y-auto">
        <div className="w-full flex justify-between items-center">
          <h1 className="text-2xl font-bold mb-4">Accounts</h1>
        </div>

        <div className="w-full flex justify-between items-center gap-8">
          <div className="w-full flex items-center gap-2">
            <Input
              placeholder="Search by account/ type"
              value={(table.getState().globalFilter as string) ?? ""}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
              className="bg-white"
            />
            <Select
              onValueChange={(value) => {
                table
                  .getColumn("accountType")
                  ?.setFilterValue(value === "all" ? undefined : value);
              }}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Filter by account type" />
              </SelectTrigger>

              <SelectContent
                position="popper"
                side="bottom"
              >
                <SelectItem value="all">
                  All Account Types
                </SelectItem>

                {accountTypes.map((accountType) => (
                  <SelectItem
                    key={accountType.id}
                    value={accountType.name}
                  >
                    {accountType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AddAccountDialog />
        </div>

        <div className="grid grid-cols-3 gap-x-6 gap-y-4">
          {table.getRowModel().rows.map((row) => {
            const account = row.original;

            return (
              <div
                key={account.id}
                className="min-h-32 bg-white rounded-md shadow cursor-pointer"
                onClick={() => router.push(`/accounts/${account.id}`)}
              >
                <div className="h-full flex flex-col items-center justify-center">
                  <span className="text-xl font-semibold">
                    LKR {account.balance.toFixed(2)}
                  </span>
                  <span className="font-light">{account.name}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}
