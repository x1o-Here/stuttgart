import { z } from "zod";

/** POST /companies/:c/vat-payments (VAT tab → Record payment). */
export const vatPaymentInputSchema = z.object({
  quarterKey: z.string().min(1),
  quarterLabel: z.string().min(1),
  /** VAT due for the quarter (output − input), as shown on the VAT tab. */
  due: z.coerce.number(),
  date: z.coerce.date(),
  amount: z.coerce.number(),
  reference: z.string().default(""),
  accountId: z.string().min(1, "Select the paying account"),
});

/** POST /vat-payments/:id/delete */
export const vatPaymentDeleteSchema = z.object({ quarterLabel: z.string().default("") });

/** POST /companies/:c/reports (Reports → New custom report). */
export const reportInputSchema = z.object({
  name: z.string().trim().min(1, "Report name is required"),
  description: z.string().default(""),
  fromDate: z.coerce.date().nullish(),
  toDate: z.coerce.date().nullish(),
  accountIds: z.array(z.string()).default([]),
});

/** PATCH /reports/:id/filters (the saved filter bar on a custom report). */
export const reportFiltersSchema = z.object({ filters: z.record(z.string(), z.unknown()) });
