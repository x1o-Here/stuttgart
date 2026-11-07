"use client";

import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import {
  CircleX,
  Download,
  Filter,
  Save,
  Search,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { TransactionTypeFilterSelect } from "@/components/shared/transaction-type-filter-select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import {
  AccountsLedgerProvider,
  useAccountsContext,
} from "@/contexts/useAccountsContext";
import { useCustomReport } from "@/hooks/use-custom-reports";
import { db } from "@/lib/firebase/firebase-client";
import { matchesTagFilter, TAG_OPTIONS } from "@/lib/helpers/transaction-tags";
import ExportReportDialog from "./components/export-report-dialog";
import ShareReportDialog from "./components/share-report-dialog";

function CustomReportPageContent() {
  const params = useParams();
  const reportId = typeof params.id === "string" ? params.id : undefined;
  const { report, loading, error } = useCustomReport(reportId);
  const { accounts } = useAccountsContext();
  const { activeCompany } = useAuth();

  const [accountFilter, setAccountFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState<string[]>(["active"]);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  useEffect(() => {
    if (!report || filtersHydrated) return;

    if (report.filters) {
      setAccountFilter(report.filters.accountFilter || "all");
      setTypeFilter(report.filters.typeFilter || "all");
      setDepartmentFilter(report.filters.departmentFilter || "all");
      setVehicleFilter(report.filters.vehicleFilter || "all");
      setTagFilter(
        Array.isArray(report.filters.tagFilter) &&
          report.filters.tagFilter.length
          ? report.filters.tagFilter
          : ["active"],
      );
    }

    setFiltersHydrated(true);
  }, [report, filtersHydrated]);

  useEffect(() => {
    setFiltersHydrated(false);
  }, [reportId]);

  const periodBounds = useMemo(() => {
    if (!report) return { fromTime: undefined, toTime: undefined };
    return {
      fromTime: report.fromDate
        ? new Date(report.fromDate).setHours(0, 0, 0, 0)
        : undefined,
      toTime: report.toDate
        ? new Date(report.toDate).setHours(23, 59, 59, 999)
        : undefined,
    };
  }, [report]);

  const selectedAccounts = useMemo(() => {
    if (!report) return [];
    const selectedIds = new Set(report.accountIds || []);
    return accounts.filter((account) => selectedIds.has(account.id));
  }, [accounts, report]);

  const accountSummaries = useMemo(() => {
    const { fromTime, toTime } = periodBounds;

    return selectedAccounts.map((account) => {
      let credits = 0;
      let debits = 0;

      account.transactions.forEach((tx) => {
        const txTime = new Date(tx.date).getTime();
        if (
          fromTime !== undefined &&
          toTime !== undefined &&
          (txTime < fromTime || txTime > toTime)
        ) {
          return;
        }

        if (tx.type === "credit") credits += tx.amount;
        else debits += tx.amount;
      });

      return {
        id: account.id,
        name: account.name,
        credits,
        debits,
        net: credits - debits,
      };
    });
  }, [selectedAccounts, periodBounds]);

  const transactionSummaries = useMemo(() => {
    const { fromTime, toTime } = periodBounds;

    return selectedAccounts
      .flatMap((account) =>
        account.transactions
          .filter((tx) => {
            const txTime = new Date(tx.date).getTime();
            if (fromTime !== undefined && txTime < fromTime) return false;
            if (toTime !== undefined && txTime > toTime) return false;
            return true;
          })
          .map((tx) => ({
            id: `${account.id}-${tx.id}`,
            accountId: account.id,
            date: new Date(tx.date),
            accountName: account.name,
            description: tx.description,
            type: tx.type,
            amount: tx.amount,
            department: tx.department,
            vehicle: tx.vehicle,
            voucher: tx.voucher,
            tags: tx.tags || [],
          })),
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [selectedAccounts, periodBounds]);

  const departmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        transactionSummaries
          .map((tx) => tx.department)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort();
  }, [transactionSummaries]);

  const vehicleOptions = useMemo(() => {
    return Array.from(
      new Set(
        transactionSummaries
          .map((tx) => tx.vehicle)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort();
  }, [transactionSummaries]);

  const filteredTransactions = useMemo(() => {
    const query = transactionSearch.trim().toLowerCase();

    return transactionSummaries.filter((tx) => {
      if (accountFilter !== "all" && tx.accountId !== accountFilter)
        return false;
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (departmentFilter !== "all" && tx.department !== departmentFilter)
        return false;
      if (vehicleFilter !== "all" && tx.vehicle !== vehicleFilter) return false;
      if (!matchesTagFilter(tx.tags, tagFilter)) return false;

      if (query) {
        const description = (tx.description || "").toLowerCase();
        const localeDate = tx.date.toLocaleDateString().toLowerCase();
        const isoDate = tx.date.toISOString().slice(0, 10);
        const day = String(tx.date.getDate());
        const month = String(tx.date.getMonth() + 1);
        const year = String(tx.date.getFullYear());
        const paddedDay = day.padStart(2, "0");
        const paddedMonth = month.padStart(2, "0");
        const slashDate = `${paddedDay}/${paddedMonth}/${year}`;
        const dashDate = `${paddedDay}-${paddedMonth}-${year}`;

        const matchesDescription = description.includes(query);
        const matchesDate =
          localeDate.includes(query) ||
          isoDate.includes(query) ||
          slashDate.includes(query) ||
          dashDate.includes(query) ||
          `${day}/${month}/${year}`.includes(query) ||
          `${month}/${day}/${year}`.includes(query);

        if (!matchesDescription && !matchesDate) return false;
      }

      return true;
    });
  }, [
    transactionSummaries,
    accountFilter,
    typeFilter,
    departmentFilter,
    vehicleFilter,
    tagFilter,
    transactionSearch,
  ]);

  const hasActiveFilters =
    accountFilter !== "all" ||
    typeFilter !== "all" ||
    departmentFilter !== "all" ||
    vehicleFilter !== "all" ||
    tagFilter.length !== 1 ||
    tagFilter[0] !== "active" ||
    transactionSearch.trim() !== "";

  function clearFilters() {
    setAccountFilter("all");
    setTypeFilter("all");
    setDepartmentFilter("all");
    setVehicleFilter("all");
    setTagFilter(["active"]);
    setTransactionSearch("");
  }

  async function handleSaveFilters() {
    if (!activeCompany || !reportId || !report) return;

    const nextFilters = {
      accountFilter,
      typeFilter,
      departmentFilter,
      vehicleFilter,
      tagFilter,
    };
    const prev = report.filters;
    const unchanged =
      prev &&
      prev.accountFilter === nextFilters.accountFilter &&
      prev.typeFilter === nextFilters.typeFilter &&
      prev.departmentFilter === nextFilters.departmentFilter &&
      prev.vehicleFilter === nextFilters.vehicleFilter &&
      JSON.stringify(prev.tagFilter ?? []) ===
        JSON.stringify(nextFilters.tagFilter);

    if (unchanged) return;

    setSaving(true);
    try {
      await updateDoc(
        doc(db, "companies", activeCompany, "reports", reportId),
        {
          filters: nextFilters,
          updatedAt: serverTimestamp(),
        },
      );
    } catch (err) {
      console.error("Failed to save report filters:", err);
    } finally {
      setSaving(false);
    }
  }

  let tagButtonLabel = "All";
  if (tagFilter.length === 1) {
    tagButtonLabel =
      tagFilter[0].charAt(0).toUpperCase() + tagFilter[0].slice(1);
  } else if (tagFilter.length > 1) {
    tagButtonLabel = "Displaying";
  }

  if (loading) {
    return (
      <div className="h-full bg-card p-4 font-sans md:p-6">
        <LoadingState message="Loading report..." variant="bar" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-card p-6 text-center font-sans">
        <span className="eyebrow">( Not found )</span>
        <p className="heading text-2xl">
          <span className="text-muted-foreground">This report</span>{" "}
          {error ? "could not be loaded." : "doesn’t exist."}
        </p>
        <Link
          href="/reports"
          className="font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to reports
        </Link>
      </div>
    );
  }

  const period =
    report.fromDate && report.toDate
      ? `${report.fromDate.toLocaleDateString()} – ${report.toDate.toLocaleDateString()}`
      : "No period set";
  const accountCount = report.accountIds?.length || 0;
  const tabTrigger =
    "h-10 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 font-normal text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";
  const th =
    "font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground first:pl-4 last:pr-4 md:first:pl-6 md:last:pr-6";
  const td = "py-2.5 first:pl-4 last:pr-4 md:first:pl-6 md:last:pr-6";
  const signed = (value: number) =>
    `${value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString()}`;

  return (
    <div className="flex h-full flex-col divide-y overflow-y-auto bg-card font-sans">
      <PageHeader
        back={{ href: "/reports", label: "Reports" }}
        eyebrow="( Reports · Custom )"
        title={report.name}
        description={`${period} · ${accountCount} account${accountCount === 1 ? "" : "s"}`}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveFilters}
              disabled={saving}
            >
              <Save />
              {saving ? "Saving…" : "Save filters"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShareOpen(true)}
            >
              <Share2 />
              Share
            </Button>
            <Button type="button" onClick={() => setExportOpen(true)}>
              <Download />
              Export
            </Button>
          </>
        }
      />

      {report.description ? (
        <p className="max-w-3xl px-4 py-3 text-sm text-muted-foreground md:px-6">
          {report.description}
        </p>
      ) : null}

      <Tabs
        defaultValue="accounts"
        className="flex min-h-[24rem] flex-1 flex-col gap-0"
      >
        <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-0 border-b bg-transparent p-0 px-4 md:px-6">
          <TabsTrigger value="accounts" className={tabTrigger}>
            01 / Account summary
          </TabsTrigger>
          <TabsTrigger value="transactions" className={tabTrigger}>
            02 / Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-0 overflow-auto">
          <Table>
            <TableHeader className="bg-surface-muted">
              <TableRow className="hover:bg-transparent">
                <TableHead className={th}>Account</TableHead>
                <TableHead className={`text-right ${th}`}>Debits</TableHead>
                <TableHead className={`text-right ${th}`}>Credits</TableHead>
                <TableHead className={`text-right ${th}`}>Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountSummaries.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No accounts in this report.
                  </TableCell>
                </TableRow>
              ) : (
                accountSummaries.map((item) => (
                  <TableRow key={item.id} className="hover:bg-surface-muted">
                    <TableCell className={`font-medium text-foreground ${td}`}>
                      {item.name}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums ${td} ${item.debits > 0 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {item.debits > 0
                        ? `−${item.debits.toLocaleString()}`
                        : "0"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums ${td} ${item.credits > 0 ? "text-success" : "text-muted-foreground"}`}
                    >
                      {item.credits > 0
                        ? `+${item.credits.toLocaleString()}`
                        : "0"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums text-foreground ${td}`}
                    >
                      {signed(item.net)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="transactions" className="mt-0 flex flex-col">
          <div className="flex flex-col gap-3 px-4 py-3 md:px-6">
            <div className="flex items-baseline gap-3">
              <span className="eyebrow normal-case tracking-normal">
                Transactions
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {filteredTransactions.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-48 flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={transactionSearch}
                  onChange={(event) => setTransactionSearch(event.target.value)}
                  placeholder="Search by date or description"
                  className="pl-8"
                />
              </div>

              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-full bg-card sm:w-44">
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {selectedAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <TransactionTypeFilterSelect
                value={typeFilter}
                onChange={setTypeFilter}
              />

              <Select
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
              >
                <SelectTrigger className="w-full bg-card sm:w-44">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departmentOptions.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                <SelectTrigger className="w-full bg-card sm:w-44">
                  <SelectValue placeholder="Vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All vehicles</SelectItem>
                  {vehicleOptions.map((vehicle) => (
                    <SelectItem key={vehicle} value={vehicle}>
                      {vehicle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Filter />
                    {tagButtonLabel}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {TAG_OPTIONS.map((status) => {
                    const isSelected = tagFilter.includes(status);

                    return (
                      <DropdownMenuCheckboxItem
                        key={status}
                        checked={isSelected}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(checked) => {
                          setTagFilter((current) => {
                            if (checked) return [...current, status];
                            return current.filter((value) => value !== status);
                          });
                        }}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {hasActiveFilters ? (
                <Button type="button" variant="ghost" onClick={clearFilters}>
                  <CircleX />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          <div className="overflow-auto border-t">
            <Table>
              <TableHeader className="bg-surface-muted">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={th}>Date</TableHead>
                  <TableHead className={th}>Account</TableHead>
                  <TableHead className={th}>Description</TableHead>
                  <TableHead className={th}>Dept</TableHead>
                  <TableHead className={th}>Vehicle</TableHead>
                  <TableHead className={th}>V/No</TableHead>
                  <TableHead className={`text-right ${th}`}>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No transactions match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow
                      key={tx.id}
                      className="text-foreground/80 hover:bg-surface-muted"
                    >
                      <TableCell
                        className={`font-mono text-xs tabular-nums text-muted-foreground ${td}`}
                      >
                        {tx.date.toLocaleDateString()}
                      </TableCell>
                      <TableCell
                        className={`font-medium text-foreground ${td}`}
                      >
                        {tx.accountName}
                      </TableCell>
                      <TableCell className={`max-w-xs truncate ${td}`}>
                        {tx.description || "–"}
                      </TableCell>
                      <TableCell className={td}>
                        {tx.department || "–"}
                      </TableCell>
                      <TableCell className={`font-mono ${td}`}>
                        {tx.vehicle || "–"}
                      </TableCell>
                      <TableCell className={`font-mono ${td}`}>
                        {tx.voucher || "–"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono tabular-nums ${td} ${
                          tx.type === "debit"
                            ? "text-destructive"
                            : "text-success"
                        }`}
                        title={tx.type === "debit" ? "Debit" : "Credit"}
                      >
                        {tx.type === "debit" ? "−" : "+"}
                        {tx.amount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <ShareReportDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        reportName={report.name}
      />
      <ExportReportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        reportName={report.name}
        periodLabel={
          report.fromDate && report.toDate
            ? `${report.fromDate.toLocaleDateString()} – ${report.toDate.toLocaleDateString()}`
            : "-"
        }
        fromDate={report.fromDate}
        toDate={report.toDate}
        accountNames={selectedAccounts.map((account) => account.name)}
        accountSummaries={accountSummaries}
        transactions={filteredTransactions}
      />
    </div>
  );
}

export default function CustomReportPage() {
  return (
    <AccountsLedgerProvider mode="all">
      <CustomReportPageContent />
    </AccountsLedgerProvider>
  );
}
