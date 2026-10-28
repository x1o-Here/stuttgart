import {
  collection,
  doc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Transaction,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase-client";
import {
  normalizeTaxInvoiceNo,
  roundMoney,
  splitVatInclusive,
  validateTaxInvoiceNo,
} from "@/lib/invoices/money";
import {
  type SupplierInvoice,
  type SupplierInvoiceLine,
  supplierInvoiceStatus,
} from "./supplier-model";

export class SupplierInvoiceError extends Error {}

export type SupplierInvoiceInput = {
  taxInvoiceNo: string;
  date: Date;
  totalIncludingVat: number;
  lineItems: SupplierInvoiceLine[];
};

export type SupplierPaymentInput = {
  date: Date;
  description: string;
  chequeNo: string;
  amount: number;
  /** Our account the money leaves (cash / bank). */
  debitingAccount: { id: string; name: string };
  /** The supplier's ledger account. */
  creditingAccount: { id: string; name: string };
};

const supplierRef = (c: string, s: string) =>
  doc(db, "companies", c, "suppliers", s);
const invoiceRef = (c: string, s: string, i: string) =>
  doc(db, "companies", c, "suppliers", s, "invoices", i);
// One claim per tax invoice number across ALL suppliers of the company.
const claimRef = (c: string, taxNo: string) =>
  doc(db, "companies", c, "supplierInvoiceNos", encodeURIComponent(taxNo));
const accountTxRef = (c: string, accountId: string, txId: string) =>
  doc(db, "companies", c, "accounts", accountId, "transactions", txId);
const accountRef = (c: string, accountId: string) =>
  doc(db, "companies", c, "accounts", accountId);

function audit(
  tx: Transaction,
  companyId: string,
  userId: string,
  action: string,
  description: string,
) {
  tx.set(doc(collection(db, "auditLogs")), {
    userId,
    companyId,
    action,
    description,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });
}

function validateInput(input: SupplierInvoiceInput) {
  const taxError = validateTaxInvoiceNo(input.taxInvoiceNo);
  if (taxError) throw new SupplierInvoiceError(taxError);
  if (!(roundMoney(input.totalIncludingVat) > 0)) {
    throw new SupplierInvoiceError("Enter the total amount including VAT.");
  }
  const lines = input.lineItems.filter((line) => line.description.trim());
  if (lines.length === 0) {
    throw new SupplierInvoiceError("Add at least one item with a description.");
  }
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new SupplierInvoiceError(
        `Quantity for “${line.description.trim()}” must be a whole number above 0.`,
      );
    }
  }
  return lines.map((line) => ({
    id: line.id,
    description: line.description.trim(),
    quantity: line.quantity,
  }));
}

async function claimTaxNo(
  tx: Transaction,
  companyId: string,
  taxNo: string,
  supplierId: string,
  invoiceId: string,
) {
  const claim = await tx.get(claimRef(companyId, taxNo));
  if (claim.exists() && claim.data().invoiceId !== invoiceId) {
    const ownerId = claim.data().supplierId as string;
    const owner = ownerId
      ? await tx.get(supplierRef(companyId, ownerId))
      : null;
    const ownerName = owner?.exists() ? (owner.data().name as string) : "";
    throw new SupplierInvoiceError(
      `Tax invoice no ${taxNo} already exists${ownerName ? ` for ${ownerName}` : ""}.`,
    );
  }
  tx.set(claimRef(companyId, taxNo), { supplierId, invoiceId });
}

export async function createSupplierInvoice(
  companyId: string,
  userId: string,
  supplier: { id: string; name: string },
  input: SupplierInvoiceInput,
) {
  const lineItems = validateInput(input);
  const taxNo = normalizeTaxInvoiceNo(input.taxInvoiceNo);
  const split = splitVatInclusive(input.totalIncludingVat);
  const ref = doc(
    collection(
      db,
      "companies",
      companyId,
      "suppliers",
      supplier.id,
      "invoices",
    ),
  );

  await runTransaction(db, async (tx) => {
    await claimTaxNo(tx, companyId, taxNo, supplier.id, ref.id);
    tx.set(ref, {
      taxInvoiceNo: taxNo,
      date: Timestamp.fromDate(input.date),
      totalIncludingVat: split.total,
      billAmount: split.billAmount,
      vatAmount: split.vatAmount,
      lineItems,
      outstandingAmount: split.total,
      status: "issued",
      entityStatus: true,
      createdAt: serverTimestamp(),
      createdBy: userId,
    });
    audit(
      tx,
      companyId,
      userId,
      "create",
      `Supplier invoice ${taxNo} submitted for ${supplier.name}`,
    );
  });
  return ref.id;
}

export async function updateSupplierInvoice(
  companyId: string,
  userId: string,
  supplier: { id: string; name: string },
  invoiceId: string,
  input: SupplierInvoiceInput,
) {
  const lineItems = validateInput(input);
  const taxNo = normalizeTaxInvoiceNo(input.taxInvoiceNo);
  const split = splitVatInclusive(input.totalIncludingVat);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(invoiceRef(companyId, supplier.id, invoiceId));
    if (!snap.exists() || snap.data().entityStatus === false) {
      throw new SupplierInvoiceError("This invoice no longer exists.");
    }
    const data = snap.data();
    const oldTotal = roundMoney(Number(data.totalIncludingVat) || 0);
    const oldOutstanding = roundMoney(Number(data.outstandingAmount) || 0);
    const paid = roundMoney(oldTotal - oldOutstanding);
    if (split.total < paid) {
      throw new SupplierInvoiceError(
        `The total can’t be less than the LKR ${paid.toLocaleString("en-US", { minimumFractionDigits: 2 })} already paid.`,
      );
    }

    const oldTaxNo = data.taxInvoiceNo as string;
    if (taxNo !== oldTaxNo) {
      await claimTaxNo(tx, companyId, taxNo, supplier.id, invoiceId);
      tx.delete(claimRef(companyId, oldTaxNo));
    }

    const outstanding = roundMoney(split.total - paid);
    tx.update(invoiceRef(companyId, supplier.id, invoiceId), {
      taxInvoiceNo: taxNo,
      date: Timestamp.fromDate(input.date),
      totalIncludingVat: split.total,
      billAmount: split.billAmount,
      vatAmount: split.vatAmount,
      lineItems,
      outstandingAmount: outstanding,
      status: supplierInvoiceStatus(split.total, outstanding),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    audit(
      tx,
      companyId,
      userId,
      "update",
      `Supplier invoice ${taxNo} updated for ${supplier.name}`,
    );
  });
}

export async function deleteSupplierInvoice(
  companyId: string,
  userId: string,
  supplier: { id: string; name: string },
  invoice: SupplierInvoice,
) {
  const payments = await getDocs(
    query(
      collection(invoiceRef(companyId, supplier.id, invoice.id), "payments"),
      where("entityStatus", "==", true),
    ),
  );
  if (!payments.empty) {
    throw new SupplierInvoiceError(
      "This invoice has payments. Delete its payments first.",
    );
  }

  await runTransaction(db, async (tx) => {
    tx.update(invoiceRef(companyId, supplier.id, invoice.id), {
      entityStatus: false,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    tx.delete(claimRef(companyId, invoice.taxInvoiceNo));
    audit(
      tx,
      companyId,
      userId,
      "delete",
      `Supplier invoice ${invoice.taxInvoiceNo} deleted for ${supplier.name}`,
    );
  });
}

/**
 * Records (or, with `paymentId`, edits) a payment to a supplier. Money moves
 * from our debiting account to the supplier's account; the invoice's
 * outstanding amount is recomputed from its current stored value.
 */
export async function saveSupplierPayment(
  companyId: string,
  userId: string,
  supplier: { id: string; name: string },
  invoiceId: string,
  input: SupplierPaymentInput,
  existing?: {
    id: string;
    amount: number;
    transactionId: string;
    debitingAccountId: string;
    creditingAccountId: string;
  },
) {
  const amount = roundMoney(input.amount);
  if (!(amount > 0)) {
    throw new SupplierInvoiceError("Enter an amount greater than zero.");
  }
  if (input.debitingAccount.id === input.creditingAccount.id) {
    throw new SupplierInvoiceError(
      "Pay from an account other than the supplier’s own account.",
    );
  }

  const invRef = invoiceRef(companyId, supplier.id, invoiceId);
  const paymentRef = existing
    ? doc(invRef, "payments", existing.id)
    : doc(collection(invRef, "payments"));
  const transactionId =
    existing?.transactionId || doc(collection(db, "transactions")).id;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(invRef);
    if (!snap.exists() || snap.data().entityStatus === false) {
      throw new SupplierInvoiceError("This invoice no longer exists.");
    }
    const data = snap.data();
    const total = roundMoney(Number(data.totalIncludingVat) || 0);
    const currentOutstanding = roundMoney(Number(data.outstandingAmount) || 0);
    const available = roundMoney(
      currentOutstanding + (existing ? existing.amount : 0),
    );
    if (amount > available) {
      throw new SupplierInvoiceError(
        `Amount can’t exceed the LKR ${available.toLocaleString("en-US", { minimumFractionDigits: 2 })} outstanding.`,
      );
    }
    const taxNo = data.taxInvoiceNo as string;

    if (existing) {
      // Reverse the previous entry before applying the new one.
      tx.update(accountRef(companyId, existing.debitingAccountId), {
        balance: increment(existing.amount),
      });
      tx.update(accountRef(companyId, existing.creditingAccountId), {
        balance: increment(-existing.amount),
      });
      if (existing.debitingAccountId !== input.debitingAccount.id) {
        tx.delete(
          accountTxRef(companyId, existing.debitingAccountId, transactionId),
        );
      }
      if (existing.creditingAccountId !== input.creditingAccount.id) {
        tx.delete(
          accountTxRef(companyId, existing.creditingAccountId, transactionId),
        );
      }
    }

    const date = Timestamp.fromDate(input.date);
    const txPayload = {
      date,
      amount,
      department: "",
      vehicle: "",
      voucherNo: 0,
      description: input.description.trim(),
      chequeNo: input.chequeNo.trim(),
      tags: ["supplier-payment", taxNo],
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierInvoiceId: invoiceId,
      invoiceNo: taxNo,
      paymentId: paymentRef.id,
      updatedAt: serverTimestamp(),
    };
    tx.set(
      accountTxRef(companyId, input.debitingAccount.id, transactionId),
      { ...txPayload, type: "debit", createdAt: serverTimestamp() },
      { merge: true },
    );
    tx.set(
      accountTxRef(companyId, input.creditingAccount.id, transactionId),
      { ...txPayload, type: "credit", createdAt: serverTimestamp() },
      { merge: true },
    );
    tx.update(accountRef(companyId, input.debitingAccount.id), {
      balance: increment(-amount),
    });
    tx.update(accountRef(companyId, input.creditingAccount.id), {
      balance: increment(amount),
    });

    tx.set(
      paymentRef,
      {
        date,
        description: input.description.trim(),
        chequeNo: input.chequeNo.trim(),
        amount,
        debitingAccountId: input.debitingAccount.id,
        debitingAccountName: input.debitingAccount.name,
        creditingAccountId: input.creditingAccount.id,
        creditingAccountName: input.creditingAccount.name,
        transactionId,
        entityStatus: true,
        updatedAt: serverTimestamp(),
        ...(existing
          ? {}
          : { createdAt: serverTimestamp(), createdBy: userId }),
      },
      { merge: true },
    );

    const nextOutstanding = roundMoney(available - amount);
    tx.update(invRef, {
      outstandingAmount: nextOutstanding,
      status: supplierInvoiceStatus(total, nextOutstanding),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    audit(
      tx,
      companyId,
      userId,
      existing ? "update" : "create",
      `Payment of LKR ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${existing ? "updated" : "recorded"} for supplier invoice ${taxNo} (${supplier.name})`,
    );
  });
}

export async function deleteSupplierPayment(
  companyId: string,
  userId: string,
  supplier: { id: string; name: string },
  invoiceId: string,
  payment: {
    id: string;
    amount: number;
    transactionId: string;
    debitingAccountId: string;
    creditingAccountId: string;
  },
) {
  const invRef = invoiceRef(companyId, supplier.id, invoiceId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(invRef);
    if (!snap.exists()) throw new SupplierInvoiceError("Invoice not found.");
    const data = snap.data();
    const total = roundMoney(Number(data.totalIncludingVat) || 0);
    const nextOutstanding = roundMoney(
      Math.min(total, (Number(data.outstandingAmount) || 0) + payment.amount),
    );

    tx.update(doc(invRef, "payments", payment.id), {
      entityStatus: false,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    if (payment.transactionId) {
      tx.delete(
        accountTxRef(
          companyId,
          payment.debitingAccountId,
          payment.transactionId,
        ),
      );
      tx.delete(
        accountTxRef(
          companyId,
          payment.creditingAccountId,
          payment.transactionId,
        ),
      );
    }
    tx.update(accountRef(companyId, payment.debitingAccountId), {
      balance: increment(payment.amount),
    });
    tx.update(accountRef(companyId, payment.creditingAccountId), {
      balance: increment(-payment.amount),
    });
    tx.update(invRef, {
      outstandingAmount: nextOutstanding,
      status: supplierInvoiceStatus(total, nextOutstanding),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    audit(
      tx,
      companyId,
      userId,
      "delete",
      `Payment of LKR ${payment.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} deleted from supplier invoice ${data.taxInvoiceNo} (${supplier.name})`,
    );
  });
}
