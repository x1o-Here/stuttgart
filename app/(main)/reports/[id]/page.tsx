"use client";

import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import {
  ArrowLeft,
  CircleX,
  Download,
  Filter,
  Save,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TransactionTypeFilterSelect } from "@/components/shared/transaction-type-filter-select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { useCustomReport } from "@/hooks/use-custom-reports";
import { db } from "@/lib/firebase/firebase-client";
import { matchesTagFilter, TAG_OPTIONS } from "@/lib/helpers/transaction-tags";
import ExportReportDialog from "./components/export-report-dialog";
import ShareReportDialog from "./components/share-report-dialog";

export default function CustomReportPage() {
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
    return transactionSummaries.filter((tx) => {
      if (accountFilter !== "all" && tx.accountId !== accountFilter)
        return false;
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (departmentFilter !== "all" && tx.department !== departmentFilter)
        return false;
      if (vehicleFilter !== "all" && tx.vehicle !== vehicleFilter) return false;
      if (!matchesTagFilter(tx.tags, tagFilter)) return false;
      return true;
    });
  }, [
    transactionSummaries,
    accountFilter,
    typeFilter,
    departmentFilter,
    vehicleFilter,
    tagFilter,
  ]);

  const hasActiveFilters =
    accountFilter !== "all" ||
    typeFilter !== "all" ||
    departmentFilter !== "all" ||
    vehicleFilter !== "all" ||
    tagFilter.length !== 1 ||
    tagFilter[0] !== "active";

  function clearFilters() {
    setAccountFilter("all");
    setTypeFilter("all");
    setDepartmentFilter("all");
    setVehicleFilter("all");
    setTagFilter(["active"]);
  }

  async function handleSaveFilters() {
    if (!activeCompany || !reportId) return;

    setSaving(true);
    try {
      await updateDoc(
        doc(db, "companies", activeCompany, "reports", reportId),
        {
          filters: {
            accountFilter,
            typeFilter,
            departmentFilter,
            vehicleFilter,
            tagFilter,
          },
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

  return (
    <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
      <div className="w-full h-full p-4 bg-zinc-100 rounded-lg overflow-y-auto">
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/reports">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to reports
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-8 text-center text-zinc-500">
            Loading report...
          </div>
        ) : error || !report ? (
          <div className="bg-white rounded-xl p-8 text-center text-red-500">
            {error || "Report not found"}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6">
              <h1 className="text-2xl font-bold text-zinc-800">
                {report.name}
              </h1>
              {report.description ? (
                <p className="text-zinc-500 mt-2">{report.description}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-600">
                {report.fromDate && report.toDate ? (
                  <span>
                    Period:{" "}
                    <strong>
                      {report.fromDate.toLocaleDateString()} –{" "}
                      {report.toDate.toLocaleDateString()}
                    </strong>
                  </span>
                ) : null}
                <span>
                  Accounts: <strong>{report.accountIds?.length || 0}</strong>
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6">
              <Tabs defaultValue="accounts">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <TabsList className="gap-1 p-0 bg-transparent">
                    <TabsTrigger
                      value="accounts"
                      className="data-[state=active]:bg-zinc-100 data-[state=active]:shadow-none data-[state=active]:font-medium font-normal cursor-pointer"
                    >
                      Account summary
                    </TabsTrigger>
                    <TabsTrigger
                      value="transactions"
                      className="data-[state=active]:bg-zinc-100 data-[state=active]:shadow-none data-[state=active]:font-medium font-normal cursor-pointer"
                    >
                      Transaction summary
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSaveFilters}
                      disabled={saving}
                    >
                      <Save className="mr-1.5 h-4 w-4" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShareOpen(true)}
                    >
                      <Share2 className="mr-1.5 h-4 w-4" />
                      Share
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExportOpen(true)}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </div>

                <TabsContent value="accounts" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Debits</TableHead>
                        <TableHead className="text-right">Credits</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountSummaries.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-zinc-500 py-8"
                          >
                            No accounts in this report
                          </TableCell>
                        </TableRow>
                      ) : (
                        accountSummaries.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.name}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-600">
                              {item.debits > 0
                                ? `-${item.debits.toLocaleString()}`
                                : "0"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-emerald-600">
                              {item.credits > 0
                                ? `+${item.credits.toLocaleString()}`
                                : "0"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-zinc-700">
                              {item.net.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="transactions" className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={accountFilter}
                      onValueChange={setAccountFilter}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Account" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Accounts</SelectItem>
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
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departmentOptions.map((department) => (
                          <SelectItem key={department} value={department}>
                            {department}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={vehicleFilter}
                      onValueChange={setVehicleFilter}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vehicles</SelectItem>
                        {vehicleOptions.map((vehicle) => (
                          <SelectItem key={vehicle} value={vehicle}>
                            {vehicle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="items-center gap-2"
                        >
                          <Filter className="h-4 w-4" />
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
                                  return current.filter(
                                    (value) => value !== status,
                                  );
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={clearFilters}
                        title="Clear filters"
                      >
                        <CircleX className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Dept</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Voucher</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center text-zinc-500 py-8"
                          >
                            No transactions match the current filters
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTransactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell>
                              {tx.date.toLocaleDateString()}
                            </TableCell>
                            <TableCell className="font-medium">
                              {tx.accountName}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {tx.description || "-"}
                            </TableCell>
                            <TableCell>{tx.department || "-"}</TableCell>
                            <TableCell>{tx.vehicle || "-"}</TableCell>
                            <TableCell>{tx.voucher || "-"}</TableCell>
                            <TableCell>
                              <span
                                className={
                                  tx.type === "debit"
                                    ? "text-red-600"
                                    : "text-emerald-600"
                                }
                              >
                                {tx.type === "debit" ? "Debit" : "Credit"}
                              </span>
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono ${
                                tx.type === "debit"
                                  ? "text-red-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {tx.type === "debit" ? "-" : "+"}
                              {tx.amount.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </div>

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
        )}
      </div>
    </div>
  );
}
