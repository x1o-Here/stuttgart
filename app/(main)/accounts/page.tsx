"use client";

import {
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { cn } from "@/lib/utils";
import { useLookupStore } from "@/stores/use-lookup-store";
import {
  accountsColumns,
  DEFAULT_ACCOUNT_TYPE_FILTER,
} from "./components/accounts-columns";
import AddAccountDialog from "./components/add-account-dialog";

const ACCOUNTS_PAGE_SIZE = 12;

export default function AccountsPage() {
  const { accounts, loading } = useAccountsContext();
  const accountTypes = useLookupStore((s) => s.accountTypes);
  const accountTypesLoading = useLookupStore((s) => s.loading["account-types"]);

  const columns = useMemo(() => accountsColumns, []);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
    { id: "accountType", value: DEFAULT_ACCOUNT_TYPE_FILTER },
  ]);
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

  const balanceFormat = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="flex h-full flex-col divide-y bg-card font-sans">
      <PageHeader
        eyebrow="( Finance · Accounts )"
        lead="Chart of"
        title="accounts."
        description={
          loading
            ? "Loading accounts…"
            : `${filteredRows.length} shown · ${accounts.length} in total`
        }
        actions={<AddAccountDialog />}
      />

      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Input
          placeholder="Search by account or type"
          value={(table.getState().globalFilter as string) ?? ""}
          onChange={(e) => table.setGlobalFilter(e.target.value)}
          className="min-w-48 flex-1"
        />
        <Select
          value={
            (table.getColumn("accountType")?.getFilterValue() as
              | string
              | undefined) ?? "all"
          }
          onValueChange={(value) => {
            table
              .getColumn("accountType")
              ?.setFilterValue(value === "all" ? undefined : value);
          }}
        >
          <SelectTrigger className="w-full bg-card sm:w-64">
            <SelectValue placeholder="Filter by account type" />
          </SelectTrigger>

          <SelectContent position="popper" side="bottom">
            <SelectItem value={DEFAULT_ACCOUNT_TYPE_FILTER}>
              All (excl. Client & Supplier)
            </SelectItem>
            <SelectItem value="all">All account types</SelectItem>

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

      <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4">
            <LoadingState
              message="Loading accounts..."
              variant="skeleton"
              rows={6}
            />
          </div>
        ) : filteredRows.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No accounts match this search.
          </p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleRows.map((row, index) => {
                const account = row.original;
                const negative = account.balance < 0;

                return (
                  <Link
                    key={account.id}
                    href={`/accounts/${account.id}`}
                    className="group flex min-w-0 flex-col gap-6 border-b px-5 py-4 transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none sm:border-r"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="eyebrow min-w-0 truncate normal-case tracking-normal">
                        {String(index + 1).padStart(2, "0")} /{" "}
                        {account.accountType || "Unassigned"}
                      </span>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <TruncatedText className="font-medium text-foreground">
                        {account.name}
                      </TruncatedText>
                      <p className="flex min-w-0 items-baseline gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          LKR
                        </span>
                        <TruncatedText
                          className={cn(
                            "font-mono text-2xl font-light tabular-nums",
                            negative ? "text-destructive" : "text-foreground",
                          )}
                        >
                          {balanceFormat.format(account.balance)}
                        </TruncatedText>
                      </p>
                    </div>
                  </Link>
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
  );
}
