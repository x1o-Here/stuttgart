type PaymentProps = {
  date?: Date;
  amount?: number;
  method?: string;
  [key: string]: unknown;
};

export function calculateRemainingAmount(
  totalAmount?: number,
  payments?: PaymentProps[],
) {
  if (!totalAmount) return 0;

  const paid =
    payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) ?? 0;

  return Math.max(0, totalAmount - paid);
}

/** Alias matching historical vehicle-context naming */
export function calculateRemaining(
  total: number,
  payments: PaymentProps[] = [],
) {
  return calculateRemainingAmount(total, payments);
}

export function calculateTotalCost(
  pCost: number,
  months: number,
  quotationTotal: number,
) {
  const COC = pCost * 0.01 * months;
  return pCost + COC + quotationTotal;
}
