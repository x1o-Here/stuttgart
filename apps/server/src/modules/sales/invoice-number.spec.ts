import {
  formatInvoiceNumber,
  invoicePeriod,
  invoiceSequence,
  withInvoicePeriod,
} from '@stuttgart/shared/invoices/invoice-number';

describe('invoice numbers', () => {
  it('formats year, month, code and padded running number', () => {
    expect(formatInvoiceNumber(new Date(2026, 6, 15), 124)).toBe('26JUL_DMKT_0124');
    expect(formatInvoiceNumber(new Date(2030, 0, 1), 12345)).toBe('30JAN_DMKT_12345');
    expect(invoicePeriod(new Date(2026, 10, 30))).toBe('26NOV');
  });

  it('reads the trailing running number', () => {
    expect(invoiceSequence('26AUG_LTBG_0240')).toBe(240);
    expect(invoiceSequence('26JUL_DMKT_0124 ')).toBe(124);
    expect(invoiceSequence('INV-ABC')).toBeNull();
    expect(invoiceSequence('99999999999999999999')).toBeNull();
  });

  it('swaps the period only when the number starts with one', () => {
    expect(withInvoicePeriod('26NOV_DMKT_0241', new Date(2026, 6, 3))).toBe('26JUL_DMKT_0241');
    expect(withInvoicePeriod('CUSTOM-0241', new Date(2026, 6, 3))).toBe('CUSTOM-0241');
  });
});
