import type { InvoiceStatus } from "../../components/invoices-columns";

export type ClientAnalyticsInvoiceRow = {
  id: string;
  date: Date;
  taxInvoiceNo: string;
  status: InvoiceStatus;
  totalIncludingVat: number;
  outstandingAmount: number;
  collectedAmount: number;
  vatAmount: number;
};

export type ClientAnalyticsPaymentRow = {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  date: Date;
  description: string;
  amount: number;
  creditingAccountName: string;
};

export type ClientAnalyticsSummary = {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  vatBilled: number;
  activeInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  paymentCount: number;
};

export type ClientAnalyticsMonthPoint = {
  key: string;
  label: string;
  billed: number;
  collected: number;
};

export type ClientAnalyticsStatusPoint = {
  status: string;
  count: number;
  amount: number;
};

export type ClientAnalyticsPayload = {
  clientName: string;
  summary: ClientAnalyticsSummary;
  invoices: ClientAnalyticsInvoiceRow[];
  payments: ClientAnalyticsPaymentRow[];
  monthly: ClientAnalyticsMonthPoint[];
  statusBreakdown: ClientAnalyticsStatusPoint[];
};
