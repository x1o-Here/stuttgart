/**
 * Ledger writes through apps/server ("ledger" slice): accounts, transactions,
 * client invoices + payments + templates, suppliers + their invoices and
 * payments. Every call is one SQL transaction on the server, and every call
 * triggers dataChanged() so open screens re-read.
 */
import type {
  AccountCreate,
  InvoiceInput,
  InvoiceTemplateInput,
  PaymentInput,
  SupplierInput,
  SupplierInvoiceInput,
  TransactionInput,
} from "@stuttgart/shared/schemas/ledger";
import { api } from "@/lib/api-client";
import { dataChanged } from "../live";

const co = (companyId: string) => `/companies/${companyId}`;

async function write<T = unknown>(request: Promise<{ data: T }>): Promise<T> {
  const { data } = await request;
  dataChanged();
  return data;
}

export const ledgerApi = {
  // Accounts & transactions
  createAccount: (companyId: string, input: AccountCreate) =>
    write(api.post(`${co(companyId)}/accounts`, input)),
  createTransaction: (companyId: string, input: TransactionInput) =>
    write(api.post(`${co(companyId)}/transactions`, input)),
  correctTransaction: (
    companyId: string,
    id: string,
    input: TransactionInput,
  ) => write(api.post(`${co(companyId)}/transactions/${id}/correct`, input)),
  deleteTransaction: (companyId: string, id: string) =>
    write(api.post(`${co(companyId)}/transactions/${id}/delete`)),

  // Client invoices
  saveTemplate: (
    companyId: string,
    clientId: string,
    input: InvoiceTemplateInput,
  ) => write(api.put(`${co(companyId)}/clients/${clientId}/template`, input)),
  createInvoice: (companyId: string, clientId: string, input: InvoiceInput) =>
    write<{ id: string }>(
      api.post(`${co(companyId)}/clients/${clientId}/invoices`, input),
    ),
  updateInvoice: (
    companyId: string,
    clientId: string,
    invoiceId: string,
    input: InvoiceInput,
  ) =>
    write<{ id: string }>(
      api.put(
        `${co(companyId)}/clients/${clientId}/invoices/${invoiceId}`,
        input,
      ),
    ),
  completeInvoice: (companyId: string, clientId: string, invoiceId: string) =>
    write(
      api.post(
        `${co(companyId)}/clients/${clientId}/invoices/${invoiceId}/complete`,
      ),
    ),
  deleteInvoice: (companyId: string, clientId: string, invoiceId: string) =>
    write(
      api.delete(`${co(companyId)}/clients/${clientId}/invoices/${invoiceId}`),
    ),
  saveInvoicePayment: (
    companyId: string,
    clientId: string,
    invoiceId: string,
    input: PaymentInput,
    paymentId?: string,
  ) =>
    write(
      paymentId
        ? api.put(
            `${co(companyId)}/clients/${clientId}/invoices/${invoiceId}/payments/${paymentId}`,
            input,
          )
        : api.post(
            `${co(companyId)}/clients/${clientId}/invoices/${invoiceId}/payments`,
            input,
          ),
    ),
  deleteInvoicePayment: (
    companyId: string,
    clientId: string,
    invoiceId: string,
    paymentId: string,
  ) =>
    write(
      api.delete(
        `${co(companyId)}/clients/${clientId}/invoices/${invoiceId}/payments/${paymentId}`,
      ),
    ),

  // Suppliers
  createSupplier: (companyId: string, input: SupplierInput) =>
    write(api.post(`${co(companyId)}/suppliers`, input)),
  updateSupplier: (
    companyId: string,
    supplierId: string,
    input: SupplierInput,
  ) => write(api.patch(`${co(companyId)}/suppliers/${supplierId}`, input)),
  setSupplierStatus: (
    companyId: string,
    supplierId: string,
    status: "active" | "inactive",
  ) =>
    write(
      api.patch(`${co(companyId)}/suppliers/${supplierId}/status`, { status }),
    ),
  createSupplierInvoice: (
    companyId: string,
    supplierId: string,
    input: SupplierInvoiceInput,
  ) =>
    write<{ id: string }>(
      api.post(`${co(companyId)}/suppliers/${supplierId}/invoices`, input),
    ),
  updateSupplierInvoice: (
    companyId: string,
    supplierId: string,
    invoiceId: string,
    input: SupplierInvoiceInput,
  ) =>
    write(
      api.put(
        `${co(companyId)}/suppliers/${supplierId}/invoices/${invoiceId}`,
        input,
      ),
    ),
  deleteSupplierInvoice: (
    companyId: string,
    supplierId: string,
    invoiceId: string,
  ) =>
    write(
      api.delete(
        `${co(companyId)}/suppliers/${supplierId}/invoices/${invoiceId}`,
      ),
    ),
  saveSupplierPayment: (
    companyId: string,
    supplierId: string,
    invoiceId: string,
    input: PaymentInput,
    paymentId?: string,
  ) =>
    write(
      paymentId
        ? api.put(
            `${co(companyId)}/suppliers/${supplierId}/invoices/${invoiceId}/payments/${paymentId}`,
            input,
          )
        : api.post(
            `${co(companyId)}/suppliers/${supplierId}/invoices/${invoiceId}/payments`,
            input,
          ),
    ),
  deleteSupplierPayment: (
    companyId: string,
    supplierId: string,
    invoiceId: string,
    paymentId: string,
  ) =>
    write(
      api.delete(
        `${co(companyId)}/suppliers/${supplierId}/invoices/${invoiceId}/payments/${paymentId}`,
      ),
    ),

  /** Per-account ledger entries for many accounts in one call. */
  ledger: async (companyId: string, accountIds: string[]) =>
    (
      await api.get<
        Record<string, { id: string; data: Record<string, unknown> }[]>
      >(`${co(companyId)}/ledger`, {
        params: { accounts: accountIds.join(",") },
      })
    ).data,
};
