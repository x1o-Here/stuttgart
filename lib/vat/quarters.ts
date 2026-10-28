/**
 * Sri Lankan tax-year quarters. The year starts on 1 April:
 * Q1 Apr–Jun · Q2 Jul–Sep · Q3 Oct–Dec · Q4 Jan–Mar.
 */
export type TaxQuarter = {
  /** Stable id, e.g. "2026-27-Q1". */
  key: string;
  /** Display label, e.g. "2026/27 Q1". */
  label: string;
  /** Calendar year in which the tax year starts (April). */
  fiscalYear: number;
  quarter: 1 | 2 | 3 | 4;
  startDate: Date;
  /** Last day of the quarter (inclusive). */
  endDate: Date;
};

function build(fiscalYear: number, quarter: 1 | 2 | 3 | 4): TaxQuarter {
  // Q1 starts in April (month index 3) of the fiscal year.
  const startMonth = 3 + (quarter - 1) * 3;
  const startDate = new Date(fiscalYear, startMonth, 1);
  const endDate = new Date(fiscalYear, startMonth + 3, 0);
  const nextShort = String((fiscalYear + 1) % 100).padStart(2, "0");
  return {
    key: `${fiscalYear}-${nextShort}-Q${quarter}`,
    label: `${fiscalYear}/${nextShort} Q${quarter}`,
    fiscalYear,
    quarter,
    startDate,
    endDate,
  };
}

export function taxQuarterOf(date: Date): TaxQuarter {
  const month = date.getMonth();
  const year = date.getFullYear();
  const fiscalYear = month >= 3 ? year : year - 1;
  const quarter = (Math.floor(((month - 3 + 12) % 12) / 3) + 1) as
    | 1
    | 2
    | 3
    | 4;
  return build(fiscalYear, quarter);
}

function next(q: TaxQuarter): TaxQuarter {
  return q.quarter === 4
    ? build(q.fiscalYear + 1, 1)
    : build(q.fiscalYear, (q.quarter + 1) as 2 | 3 | 4);
}

function ordinal(q: TaxQuarter) {
  return q.fiscalYear * 4 + q.quarter;
}

/** Every quarter from `from` to `to` inclusive, oldest first. */
export function quarterRange(from: TaxQuarter, to: TaxQuarter): TaxQuarter[] {
  const out: TaxQuarter[] = [];
  let cursor = from;
  while (ordinal(cursor) <= ordinal(to)) {
    out.push(cursor);
    cursor = next(cursor);
  }
  return out;
}

export function compareQuarters(a: TaxQuarter, b: TaxQuarter) {
  return ordinal(a) - ordinal(b);
}
