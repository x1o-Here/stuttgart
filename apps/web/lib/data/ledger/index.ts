/**
 * Ledger slice for the screens: accounts, transactions, client invoices,
 * payments, templates and suppliers. Each action goes to the API or to
 * Firestore depending on the "ledger" flag; components never touch either.
 */
import { withCompanySupplier } from "@/app/(main)/clients/[id]/invoice-model";
import { usesApi } from "../flags";
import { ledgerApi } from "./api";
import * as firestore from "./firestore";

export { saveInvoice } from "./invoice-save";

type Args<F extends (...args: never[]) => unknown> = Parameters<F>[0];

const api = () => usesApi("ledger");

export function createAccount(p: Args<typeof firestore.createAccount>) {
  if (!api()) return firestore.createAccount(p);
  return ledgerApi.createAccount(p.activeCompany, {
    name: p.data.name,
    accountType: p.data.accountType,
    balance: p.data.balance,
  });
}

export function addTransaction(p: Args<typeof firestore.addTransaction>) {
  if (!api()) return firestore.addTransaction(p);
  return ledgerApi.createTransaction(p.activeCompany, {
    ...p.data,
    date: p.data.date.toISOString(),
  });
}

export function correctTransaction(
  p: Args<typeof firestore.correctTransaction>,
) {
  if (!api()) return firestore.correctTransaction(p);
  return ledgerApi.correctTransaction(p.activeCompany, p.transaction.id, {
    ...p.data,
    date: p.data.date.toISOString(),
  });
}

export function deleteTransaction(p: Args<typeof firestore.deleteTransaction>) {
  if (!api()) return firestore.deleteTransaction(p);
  return ledgerApi.deleteTransaction(p.activeCompany, p.transaction.id);
}

export function completeInvoice(p: Args<typeof firestore.completeInvoice>) {
  if (!api()) return firestore.completeInvoice(p);
  return ledgerApi.completeInvoice(p.activeCompany, p.clientId, p.invoice.id);
}

export function deleteInvoice(p: Args<typeof firestore.deleteInvoice>) {
  if (!api()) return firestore.deleteInvoice(p);
  return ledgerApi.deleteInvoice(p.activeCompany, p.clientId, p.invoiceId);
}

export function deleteInvoicePayment(
  p: Args<typeof firestore.deleteInvoicePayment>,
) {
  if (!api()) return firestore.deleteInvoicePayment(p);
  return ledgerApi.deleteInvoicePayment(
    p.activeCompany,
    p.clientId,
    p.invoice.id,
    p.payment.id,
  );
}

export function saveInvoicePayment(
  p: Args<typeof firestore.saveInvoicePayment>,
) {
  if (!api()) return firestore.saveInvoicePayment(p);
  return ledgerApi.saveInvoicePayment(
    p.activeCompany,
    p.clientId,
    p.invoice.id,
    {
      date: new Date(`${p.date}T00:00:00`).toISOString(),
      description: p.description.trim(),
      chequeNo: p.chequeNo.trim(),
      amount: p.paymentAmount,
      creditingAccountId: p.creditAccount.id,
      debitingAccountId: p.debitAccount.id,
    },
    p.payment?.id,
  );
}

export function saveTemplate(p: Args<typeof firestore.saveTemplate>) {
  if (!api()) return firestore.saveTemplate(p);
  const payload = withCompanySupplier(p.draft, p.company);
  return ledgerApi.saveTemplate(p.activeCompany, p.clientId, {
    columns: payload.columns as unknown as Record<string, unknown>[],
    signing: payload.signing as unknown as Record<string, unknown>,
    supplier: payload.supplier as unknown as Record<string, unknown>,
  });
}

export function createSupplier(p: Args<typeof firestore.createSupplier>) {
  if (!api()) return firestore.createSupplier(p);
  return ledgerApi.createSupplier(p.activeCompany, p.data);
}

export function updateSupplier(p: Args<typeof firestore.updateSupplier>) {
  if (!api()) return firestore.updateSupplier(p);
  return ledgerApi.updateSupplier(p.activeCompany, p.supplier.id, p.data);
}

export function setSupplierStatus(p: Args<typeof firestore.setSupplierStatus>) {
  if (!api()) return firestore.setSupplierStatus(p);
  return ledgerApi.setSupplierStatus(
    p.activeCompany,
    p.supplier.id,
    p.nextStatus,
  );
}
