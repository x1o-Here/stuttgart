import { roundMoney } from "@/lib/invoices/money";
import {
  compareQuarters,
  quarterRange,
  type TaxQuarter,
  taxQuarterOf,
} from "./quarters";

export type VatSourceInvoice = {
  id: string;
  date: Date;
  vatAmount: number;
  invoiceNo: string;
  partyName: string;
  /** Link to the invoice page. */
  href: string;
};

export type VatPaymentRecord = {
  id: string;
  quarterKey: string;
  date: Date;
  amount: number;
  reference: string;
  accountId: string;
  accountName: string;
  transactionId: string;
};

export type VatQuarterStatus =
  | "upcoming"
  | "in_progress"
  | "refundable"
  | "nil"
  | "paid"
  | "part_paid"
  | "payable";

export type VatQuarterRow = {
  quarter: TaxQuarter;
  outputVat: number;
  inputVat: number;
  /** outputVat − inputVat; negative means refundable. */
  due: number;
  paid: number;
  /** Still to pay: max(due, 0) − paid, never below 0. */
  balance: number;
  status: VatQuarterStatus;
  outgoing: VatSourceInvoice[];
  incoming: VatSourceInvoice[];
  payments: VatPaymentRecord[];
};

export type VatTotals = {
  /** Unpaid balances of quarters that have already ended. */
  payableOutstanding: number;
  /** VAT paid against quarters of the current tax year. */
  paidThisYear: number;
};

export const VAT_STATUS_META: Record<
  VatQuarterStatus,
  { label: string; variant: "warning" | "brand" | "success" | "neutral" }
> = {
  upcoming: { label: "Upcoming", variant: "neutral" },
  in_progress: { label: "In progress", variant: "brand" },
  payable: { label: "Payable", variant: "warning" },
  part_paid: { label: "Part paid", variant: "brand" },
  paid: { label: "Paid", variant: "success" },
  refundable: { label: "Refundable", variant: "neutral" },
  nil: { label: "Nil", variant: "neutral" },
};

/**
 * Groups output VAT (client invoices) and input VAT (supplier invoices) by
 * tax quarter of the invoice date. Due = output − input. Returns newest first,
 * from the earliest quarter with data up to the current (or latest dated)
 * quarter.
 */
export function computeVatQuarters(
  outgoing: VatSourceInvoice[],
  incoming: VatSourceInvoice[],
  payments: VatPaymentRecord[],
  today = new Date(),
): { rows: VatQuarterRow[]; totals: VatTotals } {
  const current = taxQuarterOf(today);
  const dated = [...outgoing, ...incoming].filter((i) => i.date.getTime() > 0);
  let earliest = current;
  let latest = current; // future-dated invoices extend the range forward
  for (const invoice of dated) {
    const q = taxQuarterOf(invoice.date);
    if (compareQuarters(q, earliest) < 0) earliest = q;
    if (compareQuarters(q, latest) > 0) latest = q;
  }

  const rows = new Map<string, VatQuarterRow>();
  for (const quarter of quarterRange(earliest, latest)) {
    rows.set(quarter.key, {
      quarter,
      outputVat: 0,
      inputVat: 0,
      due: 0,
      paid: 0,
      balance: 0,
      status: "nil",
      outgoing: [],
      incoming: [],
      payments: [],
    });
  }

  for (const invoice of outgoing) {
    if (!(invoice.date.getTime() > 0)) continue;
    const row = rows.get(taxQuarterOf(invoice.date).key);
    if (!row) continue;
    row.outgoing.push(invoice);
    row.outputVat += invoice.vatAmount;
  }
  for (const invoice of incoming) {
    if (!(invoice.date.getTime() > 0)) continue;
    const row = rows.get(taxQuarterOf(invoice.date).key);
    if (!row) continue;
    row.incoming.push(invoice);
    row.inputVat += invoice.vatAmount;
  }
  for (const payment of payments) {
    const row = rows.get(payment.quarterKey);
    if (!row) continue;
    row.payments.push(payment);
    row.paid += payment.amount;
  }

  let payableOutstanding = 0;
  let paidThisYear = 0;
  for (const row of rows.values()) {
    row.outputVat = roundMoney(row.outputVat);
    row.inputVat = roundMoney(row.inputVat);
    row.paid = roundMoney(row.paid);
    row.due = roundMoney(row.outputVat - row.inputVat);
    row.balance = roundMoney(Math.max(0, Math.max(0, row.due) - row.paid));
    const isCurrent = row.quarter.key === current.key;
    const isFuture = row.quarter.startDate.getTime() > today.getTime();
    const hasEnded = row.quarter.endDate.getTime() < today.getTime();

    if (isFuture) row.status = "upcoming";
    else if (row.due < 0) row.status = "refundable";
    else if (row.due === 0) row.status = isCurrent ? "in_progress" : "nil";
    else if (row.balance <= 0) row.status = "paid";
    else if (isCurrent) row.status = "in_progress";
    else if (row.paid > 0) row.status = "part_paid";
    else row.status = "payable";

    if (hasEnded) payableOutstanding += row.balance;
    if (row.quarter.fiscalYear === current.fiscalYear) paidThisYear += row.paid;

    row.outgoing.sort((a, b) => b.date.getTime() - a.date.getTime());
    row.incoming.sort((a, b) => b.date.getTime() - a.date.getTime());
    row.payments.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  return {
    rows: [...rows.values()].reverse(),
    totals: {
      payableOutstanding: roundMoney(payableOutstanding),
      paidThisYear: roundMoney(paidThisYear),
    },
  };
}
