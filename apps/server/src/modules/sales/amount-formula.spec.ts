import {
  DEFAULT_AMOUNT_FORMULA,
  evaluateAmountFormula,
  parseAmountFormula,
} from '@stuttgart/shared/invoices/amount-formula';

function run(
  formula: string,
  values: Record<string, number>,
  allowed?: string[],
) {
  const parsed = parseAmountFormula(formula, allowed);
  if (!parsed.ok) throw new Error(parsed.error);
  return evaluateAmountFormula(parsed.ast, values);
}

describe('amount formula', () => {
  it('defaults to quantity times rate', () => {
    expect(run(DEFAULT_AMOUNT_FORMULA, { quantity: 3, rate: 12.5 })).toBe(37.5);
  });

  it('respects precedence and parentheses', () => {
    expect(run('{a} + {b} * {c}', { a: 1, b: 2, c: 3 })).toBe(7);
    expect(run('({a} + {b}) * {c}', { a: 1, b: 2, c: 3 })).toBe(9);
    expect(run('10 - 4 - 3', {})).toBe(3);
    expect(run('100 / 4 / 5', {})).toBe(5);
  });

  it('supports unary minus and decimals', () => {
    expect(run('-{a} * 2', { a: 4 })).toBe(-8);
    expect(run('{a} * -.5', { a: 4 })).toBe(-2);
    expect(run('{q} * {r} - -1', { q: 2, r: 3 })).toBe(7);
  });

  it('rounds to cents and treats division by zero and missing values as 0', () => {
    expect(run('10 / 3', {})).toBe(3.33);
    expect(run('{a} / {b}', { a: 5, b: 0 })).toBe(0);
    expect(run('{a} + {missing}', { a: 5 })).toBe(5);
  });

  it('reports references and rejects unknown columns', () => {
    const parsed = parseAmountFormula('{quantity} * {rate}', [
      'quantity',
      'rate',
    ]);
    expect(parsed.ok && parsed.refs.sort()).toEqual(['quantity', 'rate']);
    expect(
      parseAmountFormula('{quantity} * {nope}', ['quantity', 'rate']).ok,
    ).toBe(false);
  });

  it('rejects bad syntax', () => {
    for (const bad of [
      '',
      '{a} *',
      '({a} + 1',
      '{a} 2',
      '{a} % 2',
      '{a',
      '()',
      '{}',
    ]) {
      expect(parseAmountFormula(bad).ok).toBe(false);
    }
  });
});
