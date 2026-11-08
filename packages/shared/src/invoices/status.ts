import { roundMoney } from "./money.js";

export type ClientInvoiceStatus =
  | "draft"
  | "issued"
  | "paid"
  | "partial"
  | "overdue"
  | "cancelled";

/** Client invoice status while collecting payments (`paid` shows as Complete in the UI). */
export function deriveStatusFromBalances(
  totalIncludingVat: number,
  outstandingAmount: number,
  currentStatus: ClientInvoiceStatus,
): ClientInvoiceStatus {
  if (currentStatus === "cancelled") return currentStatus;
  const outstanding = roundMoney(outstandingAmount);
  const total = roundMoney(totalIncludingVat);
  if (total > 0 && outstanding <= 0) return "paid";
  if (outstanding < total) return "partial";
  return currentStatus === "overdue" ? "overdue" : "issued";
}
