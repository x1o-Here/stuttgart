"use client";

import {
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { useLookupStore } from "@/stores/use-lookup-store";
import { LoadingState } from "@/components/shared/loading-state";
import { accountsColumns } from "./components/accounts-columns";
import AddAccountDialog from "./components/add-account-dialog";

const ACCOUNTS_PAGE_SIZE = 12;

export default function AccountsPage() {
  const { accounts, loading } = useAccountsContext();
  const router = useRouter();
  const accountTypes = useLookupStore((s) => s.accountTypes);
  const accountTypesLoading = useLookupStore(
    (s) => s.loading["account-types"],
  );

  const columns = useMemo(() => accountsColumns, []);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [visibleCount, setVisibleCount] = useState(ACCOUNTS_PAGE_SIZE);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

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
  });

  const filteredRows = table.getRowModel().rows;
  const visibleRows = filteredRows.slice(0, visibleCount);
  const hasMoreRows = visibleCount < filteredRows.length;

  useEffect(() => {
    setVisibleCount(ACCOUNTS_PAGE_SIZE);
    scrollAreaRef.current?.scrollTo({ top: 0 });
  }, [globalFilter, columnFilters, accounts.length]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    const scrollRoot = scrollAreaRef.current;
    if (!sentinel || !scrollRoot || !hasMoreRows) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((current) =>
            Math.min(current + ACCOUNTS_PAGE_SIZE, filteredRows.length),
          );
        }
      },
      { root: scrollRoot, rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredRows.length, hasMoreRows]);

  return (
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full flex flex-col gap-8 p-4 bg-zinc-100 rounded-lg min-h-0">
        <div className="w-full flex justify-between items-center shrink-0">
          <h1 className="text-2xl font-bold mb-4">Accounts</h1>
        </div>

        <div className="w-full flex justify-between items-center gap-8 shrink-0">
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

              <SelectContent position="popper" side="bottom">
                <SelectItem value="all">All Account Types</SelectItem>

                {accountTypesLoading ? (
                  <SelectItem value="__loading" disabled>
                    Loading types...
                  </SelectItem>
                ) : (
                  accountTypes.map((accountType) => (
                    <SelectItem key={accountType.id} value={accountType.name}>
                      {accountType.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <AddAccountDialog />
        </div>

        <div
          ref={scrollAreaRef}
          className="flex-1 min-h-0 overflow-y-auto rounded-md pr-1"
        >
          {loading ? (
            <LoadingState
              message="Loading accounts..."
              variant="skeleton"
              rows={6}
            />
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No accounts found.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                {visibleRows.map((row) => {
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
                  );
                })}
              </div>

              {hasMoreRows && (
                <div ref={loadMoreRef} className="h-8" aria-hidden />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
