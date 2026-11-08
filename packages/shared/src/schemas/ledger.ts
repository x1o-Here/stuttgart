import { z } from "zod";

/** Dates travel as ISO strings or "YYYY-MM-DD"; both become Date. */
const dateField = z.coerce.date({ error: "Enter a valid date" });
const money = z.coerce.number().refine(Number.isFinite, "Enter a number");
const positiveMoney = money.refine((n) => n > 0, "Amount must be greater than zero");

// ── Accounts ─────────────────────────────────────────────────────────────

/** New account form, and the body of POST /companies/:c/accounts. */
export const accountCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  /** Account type *name*, as the form sends it. */
  accountType: z.string().trim().min(1, "Account type is required"),
  balance: z.number().min(0, "Balance cannot be negative"),
});
export type AccountCreate = z.infer<typeof accountCreateSchema>;

// ── Transactions ─────────────────────────────────────────────────────────

/** POST /transactions and POST /transactions/:id/correct (the transaction form). */
export const transactionInputSchema = z.object({
  date: dateField,
  description: z.string().trim().min(1, "Description is required"),
  /** Department *name* (the form selects by name). */
  department: z.string().trim().min(1, "Department is required"),
  /** Vehicle *name*; empty for none. */
  vehicle: z.string().trim().optional().default(""),
  voucherNo: z.coerce.number().int().min(0).default(0),
  creditingAccount: z.string().min(1, "Crediting account is required"),
  debitingAccount: z.string().min(1, "Debiting account is required"),
  amount: positiveMoney,
});
export type TransactionInput = z.input<typeof transactionInputSchema>;

// ── Payments (client and supplier invoices share this shape) ─────────────

export const paymentInputSchema = z.object({
  date: dateField,
  description: z.string().trim().min(1, "Description is required"),
  chequeNo: z.string().trim().default(""),
  amount: positiveMoney,
  creditingAccountId: z.string().min(1, "Select a crediting account"),
  debitingAccountId: z.string().min(1, "Select a debiting account"),
});
export type PaymentInput = z.input<typeof paymentInputSchema>;

// ── Client invoices ──────────────────────────────────────────────────────

const lineItemSchema = z.object({
  date: dateField,
  vehicleNo: z.string().default(""),
  rate: money.default(0),
  amount: money,
  customValues: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
});

/** POST/PUT /clients/:clientId/invoices[/:invoiceId] (create-invoice-form). */
export const invoiceInputSchema = z.object({
  taxInvoiceNo: z.string().trim().min(1, "Tax invoice no is required"),
  date: dateField,
  delivery: z.object({
    date: dateField,
    address: z.string().trim().default(""),
    reference: z.string().trim().default(""),
  }),
  /** Client details as printed on the invoice. */
  client: z.record(z.string(), z.unknown()),
  /** Template as it is when the invoice is saved. */
  template: z.record(z.string(), z.unknown()),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line"),
  totalAmount: money,
  vatAmount: money,
  totalIncludingVat: money,
});
export type InvoiceInput = z.input<typeof invoiceInputSchema>;

/** PUT /clients/:clientId/template (edit-invoice-template-dialog). */
export const invoiceTemplateInputSchema = z.object({
  columns: z.array(z.record(z.string(), z.unknown())),
  signing: z.record(z.string(), z.unknown()),
  supplier: z.record(z.string(), z.unknown()),
});
export type InvoiceTemplateInput = z.input<typeof invoiceTemplateInputSchema>;

// ── Suppliers ────────────────────────────────────────────────────────────

/** Add / edit supplier form, and the body of POST/PATCH /suppliers[/:id]. */
export const supplierInputSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required"),
  tin: z.string().trim().min(1, "TIN is required"),
  address: z.string().trim().min(1, "Address is required"),
  /** Supplier type *name*. */
  supplierType: z.string().min(1, "Supplier type is required"),
  contactNo: z.string().trim().min(1, "Contact number is required"),
});
export type SupplierInput = z.infer<typeof supplierInputSchema>;

export const partyStatusSchema = z.object({ status: z.enum(["active", "inactive"]) });

/** POST/PUT /suppliers/:id/invoices[/:invoiceId] (supplier-invoice-form). */
export const supplierInvoiceInputSchema = z.object({
  taxInvoiceNo: z.string(),
  date: dateField,
  totalIncludingVat: money,
  lineItems: z.array(
    z.object({
      id: z.string().default(""),
      description: z.string(),
      quantity: z.coerce.number(),
    }),
  ),
});
export type SupplierInvoiceInput = z.input<typeof supplierInvoiceInputSchema>;
