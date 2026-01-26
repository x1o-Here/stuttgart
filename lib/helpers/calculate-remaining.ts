type paymentProps = {
  date: Date;
  amount: number;
  method: string;
};

export function calculateRemainingAmount(
  totalAmount?: number,
  payments?: paymentProps[],
) {
  if (!totalAmount) return 0;

  const paid =
    payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) ?? 0;

  return Math.max(0, totalAmount - paid);
}
