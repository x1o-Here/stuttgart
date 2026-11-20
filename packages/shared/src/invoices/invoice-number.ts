/**
 * Client invoice numbers: `26JUL_DMKT_0124`.
 *
 * The first part is the invoice's two-digit year and three-letter month, the
 * middle is a fixed code and the last part is a running number shared by all
 * companies. The running number is what must be unique among live invoices.
 */

export const INVOICE_NUMBER_CODE = "DMKT";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

/** `26JUL` for a date in July 2026 (local time). */
export function invoicePeriod(date: Date): string {
  return `${String(date.getFullYear() % 100).padStart(2, "0")}${MONTHS[date.getMonth()]}`;
}

/** `26JUL_DMKT_0124`; the running number is padded to at least 4 digits. */
export function formatInvoiceNumber(date: Date, sequence: number): string {
  return `${invoicePeriod(date)}_${INVOICE_NUMBER_CODE}_${String(sequence).padStart(4, "0")}`;
}

/** The running number at the end of an invoice number, or null if there is none. */
export function invoiceSequence(invoiceNo: string): number | null {
  const match = /(\d+)\s*$/.exec(invoiceNo);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value <= 2_147_483_647 ? value : null;
}

/** Replaces a leading `26JUL` period with the one for `date`; other numbers are returned unchanged. */
export function withInvoicePeriod(invoiceNo: string, date: Date): string {
  return invoiceNo.replace(/^\d{2}[A-Za-z]{3}(?=_)/, invoicePeriod(date));
}

/** `0124` for display in messages. */
export function formatSequence(sequence: number): string {
  return String(sequence).padStart(4, "0");
}
