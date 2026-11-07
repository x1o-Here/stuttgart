/** Sri Lankan VAT rate applied to tax invoices. */
export const VAT_RATE = 0.18;

export function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/** Remaining balance = total including VAT − sum of payments. */
export function outstandingFromPayments(
  totalIncludingVat: number,
  paidAmount: number,
): number {
  return roundMoney(
    Math.max(0, roundMoney(totalIncludingVat) - roundMoney(paidAmount)),
  );
}

export type VatSplit = { billAmount: number; vatAmount: number; total: number };

/**
 * Splits a VAT-inclusive total into bill amount + VAT. VAT is derived as
 * total − bill so the two parts always add back to the total exactly.
 */
export function splitVatInclusive(totalIncludingVat: number): VatSplit {
  const total = roundMoney(Math.max(0, totalIncludingVat));
  const billAmount = roundMoney(total / (1 + VAT_RATE));
  return { billAmount, vatAmount: roundMoney(total - billAmount), total };
}

/** Tax invoice numbers: exactly 15 of A–Z, 0–9, "-" or "/". */
export const TAX_INVOICE_NO_LENGTH = 15;
export const TAX_INVOICE_NO_PATTERN = /^[A-Z0-9/-]{15}$/;

export function normalizeTaxInvoiceNo(value: string) {
  return value.trim().toUpperCase();
}

/** Returns an error message, or null when the number is valid. */
export function validateTaxInvoiceNo(value: string): string | null {
  const normalized = normalizeTaxInvoiceNo(value);
  if (!normalized) return "Tax invoice no is required.";
  if (/[^A-Z0-9/-]/.test(normalized)) {
    return "Use only letters, digits, - or /.";
  }
  if (normalized.length !== TAX_INVOICE_NO_LENGTH) {
    return `Must be exactly ${TAX_INVOICE_NO_LENGTH} characters (now ${normalized.length}).`;
  }
  return null;
}
