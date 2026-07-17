import { toDate } from "@/lib/helpers/to-date";

export function calculateMonthsSincePurchase(
  purchasedDateInput: unknown,
  endDateInput?: unknown,
): number {
  const purchasedDate = toDate(purchasedDateInput);
  if (!purchasedDate) return 0;

  const endDate = toDate(endDateInput) ?? new Date();

  const yearsDiff = endDate.getFullYear() - purchasedDate.getFullYear();
  const monthsDiff = endDate.getMonth() - purchasedDate.getMonth();

  const totalMonths = yearsDiff * 12 + monthsDiff;
  return Math.max(0, totalMonths);
}
