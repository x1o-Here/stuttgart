"use client";

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { Download, Share2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { PageHeader } from "@/components/shared/page-header";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
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
  invoiceStatusLabel,
  invoiceStatusVariant,
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

// Invoice states use the app's status tokens (see DESIGN.md).
const STATUS_COLORS: Record<string, string> = {
  draft: "var(--chart-4)",
  issued: "var(--brand)",
  partial: "var(--chart-2)",
  overdue: "var(--destructive)",
  paid: "var(--success)",
  cancelled: "var(--muted-foreground)",
};

const trendConfig = {
  billed: { label: "Billed", color: "var(--chart-1)" },
  collected: { label: "Collected", color: "var(--chart-2)" },
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
                typeof data.taxInvoiceNo === "string" ? data.taxInvoiceNo : "—",
              status,
              totalIncludingVat: roundMoney(totalIncludingVat),
              outstandingAmount: roundMoney(outstandingAmount),
              collectedAmount: roundMoney(
                Math.max(0, totalIncludingVat - outstandingAmount),
              ),
              vatAmount: roundMoney(Number(data.vatAmount) || totals.vatAmount),
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
                    const mapped = mapInvoicePayment(
                      paymentDoc.id,
                      paymentData,
                    );
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

  if (loading) {
    return (
      <div className="h-full bg-card p-4 font-sans md:p-6">
        <LoadingState
          message="Loading client analytics..."
          variant="skeleton"
          rows={8}
        />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-card p-6 text-center font-sans">
        <span className="eyebrow">( Not found )</span>
        <p className="heading text-2xl">
          <span className="text-muted-foreground">This client</span> could not
          be found.
        </p>
      </div>
    );
  }

  const metrics = [
    { label: "Total billed", value: money(summary.totalBilled), unit: "LKR" },
    {
      label: "Total collected",
      value: money(summary.totalCollected),
      unit: "LKR",
    },
    {
      label: "Outstanding",
      value: money(summary.totalOutstanding),
      unit: "LKR",
    },
    { label: "VAT billed", value: money(summary.vatBilled), unit: "LKR" },
    { label: "Active invoices", value: String(summary.activeInvoices) },
    { label: "Paid invoices", value: String(summary.paidInvoices) },
    { label: "Overdue invoices", value: String(summary.overdueInvoices) },
    { label: "Payments logged", value: String(summary.paymentCount) },
  ];

  return (
    <div className="flex h-full flex-col divide-y overflow-y-auto bg-card font-sans">
      <PageHeader
        back={{
          href: clientId ? `/clients/${clientId}` : "/clients",
          label: clientName || "Client",
        }}
        eyebrow={`( ${clientName || "Client"} )`}
        lead="Client"
        title="analytics."
        description={`${invoices.length} invoices · ${payments.length} payments`}
        actions={
          <>
            <Button variant="outline" onClick={() => setShareOpen(true)}>
              <Share2 />
              Share
            </Button>
            <Button onClick={() => setExportOpen(true)}>
              <Download />
              Export
            </Button>
          </>
        }
      />

      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => (
          <MetricCard
            key={metric.label}
            label={`${String(index + 1).padStart(2, "0")} / ${metric.label}`}
            value={metric.value}
            unit={metric.unit}
          />
        ))}
      </div>

      <div className="grid gap-px bg-border lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4 bg-card px-5 py-4">
          <SectionCaption label="Billed vs collected" />
          {monthly.length ? (
            <ChartContainer config={trendConfig} className="h-64 w-full">
              <LineChart data={monthly}>
                <CartesianGrid vertical={false} strokeDasharray="2 4" />
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

        <div className="flex min-w-0 flex-col gap-4 bg-card px-5 py-4">
          <SectionCaption label="Status mix" />
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
                        fill={STATUS_COLORS[entry.status] || "var(--chart-1)"}
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
                  <CartesianGrid vertical={false} strokeDasharray="2 4" />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={4}>
                    {statusBreakdown.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] || "var(--chart-1)"}
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

      <div className="flex flex-col">
        <div className="px-4 py-3">
          <SectionCaption label="Invoices" count={invoices.length} />
        </div>
        <div className="overflow-auto border-t">
          <Table>
            <TableHeader className="bg-surface-muted">
              <TableRow className="hover:bg-transparent">
                <TableHead className={TH}>Date</TableHead>
                <TableHead className={TH}>Invoice no</TableHead>
                <TableHead className={TH}>Status</TableHead>
                <TableHead className={`${TH} text-right`}>
                  Total (LKR)
                </TableHead>
                <TableHead className={`${TH} text-right`}>
                  Outstanding (LKR)
                </TableHead>
                <TableHead className={`${TH} text-right`}>
                  Collected (LKR)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length ? (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="pl-4 font-mono text-xs tabular-nums text-muted-foreground">
                      {invoice.date.getTime()
                        ? invoice.date.toLocaleDateString()
                        : "–"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {invoice.taxInvoiceNo}
                    </TableCell>
                    <TableCell>
                      <Badge variant={invoiceStatusVariant(invoice.status)}>
                        {invoiceStatusLabel(invoice.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className={TD_NUM}>
                      {money(invoice.totalIncludingVat)}
                    </TableCell>
                    <TableCell className={TD_NUM}>
                      {money(invoice.outstandingAmount)}
                    </TableCell>
                    <TableCell className={TD_NUM}>
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

      <div className="flex flex-col">
        <div className="px-4 py-3">
          <SectionCaption label="Payments" count={payments.length} />
        </div>
        <div className="overflow-auto border-t">
          <Table>
            <TableHeader className="bg-surface-muted">
              <TableRow className="hover:bg-transparent">
                <TableHead className={TH}>Date</TableHead>
                <TableHead className={TH}>Invoice no</TableHead>
                <TableHead className={TH}>Description</TableHead>
                <TableHead className={`${TH} text-right`}>
                  Amount (LKR)
                </TableHead>
                <TableHead className={TH}>Crediting account</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length ? (
                payments.map((payment) => (
                  <TableRow key={`${payment.invoiceId}-${payment.id}`}>
                    <TableCell className="pl-4 font-mono text-xs tabular-nums text-muted-foreground">
                      {payment.date.getTime()
                        ? payment.date.toLocaleDateString()
                        : "–"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {payment.invoiceNo || "–"}
                    </TableCell>
                    <TableCell>{payment.description || "–"}</TableCell>
                    <TableCell className={TD_NUM}>
                      {money(payment.amount)}
                    </TableCell>
                    <TableCell>{payment.creditingAccountName || "–"}</TableCell>
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

const TH =
  "font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground first:pl-4 last:pr-4";
const TD_NUM = "text-right font-mono tabular-nums last:pr-4";

function SectionCaption({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="eyebrow normal-case tracking-normal">{label}</span>
      {count !== undefined && (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 bg-card px-5 py-4">
      <TruncatedText className="eyebrow normal-case tracking-normal">
        {label}
      </TruncatedText>
      <p className="flex min-w-0 items-baseline gap-2">
        {unit && (
          <span className="font-mono text-xs text-muted-foreground">
            {unit}
          </span>
        )}
        <TruncatedText className="font-mono text-2xl font-light tabular-nums text-foreground">
          {value}
        </TruncatedText>
      </p>
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
