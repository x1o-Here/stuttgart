"use client";

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { BarChart3, ChevronLeft, Download, Share2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import { toDate } from "@/lib/helpers/to-date";
import {
  type InvoiceStatus,
  isActiveInvoiceStatus,
} from "../components/invoices-columns";
import {
  calculateInvoiceTotals,
  mapInvoicePayment,
  resolveOutstandingAmount,
  roundMoney,
} from "../invoice-model";
import type {
  ClientAnalyticsInvoiceRow,
  ClientAnalyticsPayload,
  ClientAnalyticsPaymentRow,
  ClientAnalyticsSummary,
} from "./components/client-analytics-types";
import ExportClientAnalyticsDialog from "./components/export-client-analytics-dialog";
import ShareClientAnalyticsDialog from "./components/share-client-analytics-dialog";

const VALID_STATUSES: InvoiceStatus[] = [
  "draft",
  "issued",
  "paid",
  "partial",
  "overdue",
  "cancelled",
];

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  issued: "#6366f1",
  partial: "#f59e0b",
  overdue: "#f43f5e",
  paid: "#10b981",
  cancelled: "#a1a1aa",
};

const trendConfig = {
  billed: { label: "Billed", color: "#6366f1" },
  collected: { label: "Collected", color: "#10b981" },
} satisfies ChartConfig;

const statusChartConfig = {
  amount: { label: "Amount" },
} satisfies ChartConfig;

function normalizeStatus(value: unknown): InvoiceStatus {
  if (
    typeof value === "string" &&
    VALID_STATUSES.includes(value as InvoiceStatus)
  ) {
    return value as InvoiceStatus;
  }
  if (value === "active") return "issued";
  if (value === "complete" || value === "completed") return "paid";
  return "issued";
}

function money(value: number) {
  return roundMoney(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function buildSummary(
  invoices: ClientAnalyticsInvoiceRow[],
  payments: ClientAnalyticsPaymentRow[],
): ClientAnalyticsSummary {
  let totalBilled = 0;
  let totalOutstanding = 0;
  let vatBilled = 0;
  let activeInvoices = 0;
  let paidInvoices = 0;
  let overdueInvoices = 0;

  for (const invoice of invoices) {
    totalBilled += invoice.totalIncludingVat;
    vatBilled += invoice.vatAmount;
    if (isActiveInvoiceStatus(invoice.status)) {
      activeInvoices += 1;
      totalOutstanding += invoice.outstandingAmount;
    }
    if (invoice.status === "paid") paidInvoices += 1;
    if (invoice.status === "overdue") overdueInvoices += 1;
  }

  const totalCollected = payments.reduce(
    (sum, payment) => sum + payment.amount,
    0,
  );

  return {
    totalBilled: roundMoney(totalBilled),
    totalCollected: roundMoney(totalCollected),
    totalOutstanding: roundMoney(totalOutstanding),
    vatBilled: roundMoney(vatBilled),
    activeInvoices,
    paidInvoices,
    overdueInvoices,
    paymentCount: payments.length,
  };
}

export default function ClientAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const { activeCompany } = useAuth();
  const clientId = typeof params.id === "string" ? params.id : undefined;

  const [clientName, setClientName] = useState("");
  const [clientLoading, setClientLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [invoices, setInvoices] = useState<ClientAnalyticsInvoiceRow[]>([]);
  const [payments, setPayments] = useState<ClientAnalyticsPaymentRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (!activeCompany || !clientId) return;

    setClientLoading(true);
    return onSnapshot(
      doc(db, "companies", activeCompany, "clients", clientId),
      (snapshot) => {
        if (!snapshot.exists() || snapshot.data()?.entityStatus === false) {
          setClientName("");
          setNotFound(true);
        } else {
          const data = snapshot.data();
          setClientName(data.name || "Unnamed Client");
          setNotFound(false);
        }
        setClientLoading(false);
      },
      (error) => {
        console.error("Failed to fetch client for analytics:", error);
        setNotFound(true);
        setClientLoading(false);
      },
    );
  }, [activeCompany, clientId]);

  useEffect(() => {
    if (!activeCompany || !clientId || notFound) return;

    setDataLoading(true);
    const invoicesQuery = query(
      collection(
        db,
        "companies",
        activeCompany,
        "clients",
        clientId,
        "invoices",
      ),
      orderBy("date", "desc"),
    );

    return onSnapshot(
      invoicesQuery,
      async (snapshot) => {
        try {
          const nextInvoices: ClientAnalyticsInvoiceRow[] = [];
          const paymentFetches: Promise<ClientAnalyticsPaymentRow[]>[] = [];

          for (const docSnap of snapshot.docs) {
            const data = docSnap.data() as Record<string, unknown>;
            if (data.entityStatus === false) continue;

            const supplyValue = Number(data.totalAmount) || 0;
            const totals = calculateInvoiceTotals(supplyValue);
            const totalIncludingVat =
              Number(data.totalIncludingVat) || totals.totalIncludingVat;
            let outstandingAmount = resolveOutstandingAmount(
              data.outstandingAmount,
              totalIncludingVat,
            );
            let status = normalizeStatus(data.status);
            if (
              status !== "cancelled" &&
              roundMoney(totalIncludingVat) > 0 &&
              outstandingAmount <= 0
            ) {
              outstandingAmount = 0;
              status = "paid";
            }
            if (status === "paid") {
              outstandingAmount = 0;
            }

            nextInvoices.push({
              id: docSnap.id,
              date: toDate(data.date) || new Date(0),
              taxInvoiceNo:
                typeof data.taxInvoiceNo === "string"
                  ? data.taxInvoiceNo
                  : "—",
              status,
              totalIncludingVat: roundMoney(totalIncludingVat),
              outstandingAmount: roundMoney(outstandingAmount),
              collectedAmount: roundMoney(
                Math.max(0, totalIncludingVat - outstandingAmount),
              ),
              vatAmount: roundMoney(
                Number(data.vatAmount) || totals.vatAmount,
              ),
            });

            paymentFetches.push(
              getDocs(collection(docSnap.ref, "payments")).then((paymentSnap) =>
                paymentSnap.docs
                  .map((paymentDoc) => {
                    const paymentData = paymentDoc.data() as Record<
                      string,
                      unknown
                    >;
                    if (paymentData.entityStatus === false) return null;
                    const mapped = mapInvoicePayment(paymentDoc.id, paymentData);
                    return {
                      id: mapped.id,
                      invoiceId: docSnap.id,
                      invoiceNo:
                        typeof data.taxInvoiceNo === "string"
                          ? data.taxInvoiceNo
                          : "",
                      date: mapped.date,
                      description: mapped.description,
                      amount: mapped.amount,
                      creditingAccountName: mapped.creditingAccountName,
                    } satisfies ClientAnalyticsPaymentRow;
                  })
                  .filter(
                    (payment): payment is ClientAnalyticsPaymentRow =>
                      payment !== null,
                  ),
              ),
            );
          }

          const paymentGroups = await Promise.all(paymentFetches);
          setInvoices(nextInvoices);
          setPayments(
            paymentGroups
              .flat()
              .sort((a, b) => b.date.getTime() - a.date.getTime()),
          );
        } catch (error) {
          console.error("Failed to load client analytics data:", error);
        } finally {
          setDataLoading(false);
        }
      },
      (error) => {
        console.error("Failed to subscribe to client invoices:", error);
        setDataLoading(false);
      },
    );
  }, [activeCompany, clientId, notFound]);

  const summary = useMemo(
    () => buildSummary(invoices, payments),
    [invoices, payments],
  );

  const monthly = useMemo(() => {
    const map = new Map<string, { billed: number; collected: number }>();

    for (const invoice of invoices) {
      if (!invoice.date.getTime()) continue;
      const key = monthKey(invoice.date);
      const current = map.get(key) ?? { billed: 0, collected: 0 };
      current.billed += invoice.totalIncludingVat;
      map.set(key, current);
    }

    for (const payment of payments) {
      if (!payment.date.getTime()) continue;
      const key = monthKey(payment.date);
      const current = map.get(key) ?? { billed: 0, collected: 0 };
      current.collected += payment.amount;
      map.set(key, current);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, value]) => ({
        key,
        label: monthLabel(key),
        billed: roundMoney(value.billed),
        collected: roundMoney(value.collected),
      }));
  }, [invoices, payments]);

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const invoice of invoices) {
      const current = map.get(invoice.status) ?? { count: 0, amount: 0 };
      current.count += 1;
      current.amount += invoice.totalIncludingVat;
      map.set(invoice.status, current);
    }
    return Array.from(map.entries()).map(([status, value]) => ({
      status,
      count: value.count,
      amount: roundMoney(value.amount),
    }));
  }, [invoices]);

  const exportPayload: ClientAnalyticsPayload = useMemo(
    () => ({
      clientName,
      summary,
      invoices,
      payments,
      monthly,
      statusBreakdown,
    }),
    [clientName, summary, invoices, payments, monthly, statusBreakdown],
  );

  const loading = clientLoading || dataLoading;

  return (
    <div className="min-h-screen h-full p-4 font-sans">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 rounded-lg bg-zinc-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            size="sm"
            variant="ghost"
            className="w-fit px-1"
            onClick={() =>
              router.push(clientId ? `/clients/${clientId}` : "/clients")
            }
          >
            <ChevronLeft />
            Back
          </Button>

          {!loading && !notFound ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setShareOpen(true)}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button variant="outline" onClick={() => setExportOpen(true)}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <LoadingState
            message="Loading client analytics..."
            variant="skeleton"
            rows={8}
          />
        ) : notFound ? (
          <div className="rounded-lg bg-white p-6">
            <h1 className="text-xl font-semibold">Client not found</h1>
          </div>
        ) : (
          <>
            <div className="rounded-lg bg-white p-4 sm:p-6">
              <div className="mb-1 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-2xl font-bold">Client Analytics</h1>
              </div>
              <p className="text-muted-foreground">{clientName}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Total billed" value={money(summary.totalBilled)} />
              <MetricCard
                label="Total collected"
                value={money(summary.totalCollected)}
              />
              <MetricCard
                label="Outstanding"
                value={money(summary.totalOutstanding)}
              />
              <MetricCard
                label="Active invoices"
                value={String(summary.activeInvoices)}
              />
              <MetricCard
                label="Paid invoices"
                value={String(summary.paidInvoices)}
              />
              <MetricCard
                label="Overdue invoices"
                value={String(summary.overdueInvoices)}
              />
              <MetricCard label="VAT billed" value={money(summary.vatBilled)} />
              <MetricCard
                label="Payments logged"
                value={String(summary.paymentCount)}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-4 sm:p-6">
                <h2 className="mb-4 text-lg font-semibold">
                  Billed vs collected
                </h2>
                {monthly.length ? (
                  <ChartContainer config={trendConfig} className="h-64 w-full">
                    <LineChart data={monthly}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={56} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line
                        type="monotone"
                        dataKey="billed"
                        stroke="var(--color-billed)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="collected"
                        stroke="var(--color-collected)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>

              <div className="rounded-lg bg-white p-4 sm:p-6">
                <h2 className="mb-4 text-lg font-semibold">Status mix</h2>
                {statusBreakdown.length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <ChartContainer
                      config={statusChartConfig}
                      className="h-64 w-full"
                    >
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                          data={statusBreakdown}
                          dataKey="amount"
                          nameKey="status"
                          innerRadius={45}
                          outerRadius={80}
                        >
                          {statusBreakdown.map((entry) => (
                            <Cell
                              key={entry.status}
                              fill={
                                STATUS_COLORS[entry.status] || "#6366f1"
                              }
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <ChartContainer
                      config={statusChartConfig}
                      className="h-64 w-full"
                    >
                      <BarChart data={statusBreakdown}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="status" tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} width={40} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" radius={4}>
                          {statusBreakdown.map((entry) => (
                            <Cell
                              key={entry.status}
                              fill={
                                STATUS_COLORS[entry.status] || "#6366f1"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </div>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold">Invoices</h2>
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice no</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Collected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length ? (
                      invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            {invoice.date.getTime()
                              ? invoice.date.toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>{invoice.taxInvoiceNo}</TableCell>
                          <TableCell>
                            {invoice.status === "paid"
                              ? "Complete"
                              : invoice.status.charAt(0).toUpperCase() +
                                invoice.status.slice(1)}
                          </TableCell>
                          <TableCell>{money(invoice.totalIncludingVat)}</TableCell>
                          <TableCell>
                            {money(invoice.outstandingAmount)}
                          </TableCell>
                          <TableCell>
                            {money(invoice.collectedAmount)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-20 text-center text-muted-foreground"
                        >
                          No invoices yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold">Payments</h2>
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice no</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Crediting account</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length ? (
                      payments.map((payment) => (
                        <TableRow key={`${payment.invoiceId}-${payment.id}`}>
                          <TableCell>
                            {payment.date.getTime()
                              ? payment.date.toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>{payment.invoiceNo || "—"}</TableCell>
                          <TableCell>{payment.description || "—"}</TableCell>
                          <TableCell>{money(payment.amount)}</TableCell>
                          <TableCell>
                            {payment.creditingAccountName || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-20 text-center text-muted-foreground"
                        >
                          No payments yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>

      <ShareClientAnalyticsDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        clientName={clientName || "Client"}
      />
      <ExportClientAnalyticsDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        payload={exportPayload}
      />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      Not enough data to chart yet.
    </div>
  );
}
