/**
 * Ledger slice on Firestore: the write code that used to live in the account,
 * transaction, invoice, payment, template and supplier components, moved here
 * unchanged. Deleted at the cutover.
 */
import type { User } from "firebase/auth";
import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  type ClientInvoiceDocument,
  deriveStatusFromBalances,
  type InvoicePayment,
  type InvoiceTemplate,
  roundMoney,
  withCompanySupplier,
} from "@/app/(main)/clients/[id]/invoice-model";
import type { Transaction } from "@/app/(main)/components/logistics/columns";
import type { TransactionFormValues } from "@/app/(main)/components/logistics/transaction-form-fields";
import type { SupplierFormValues } from "@/app/(main)/suppliers/components/supplier-form-fields";
import type { CompanyRecord } from "@/lib/companies/types";
import {
  isSupplierAccountTypeName,
  SUPPLIER_ACCOUNT_TYPE_NAME,
  SUPPLIER_ACCOUNT_TYPE_SHORT_FORM,
} from "@/lib/constants/client-account";
import { appendAuditLog } from "@/lib/firebase/audit-log";
import { db } from "@/lib/firebase/firebase-client";
import type { Supplier } from "@/lib/suppliers/supplier-model";
import { useLookupStore } from "@/stores/use-lookup-store";

type Account = { id: string; name: string };

function accountTxRef(
  companyId: string,
  accountId: string,
  transactionId: string,
) {
  return doc(
    db,
    "companies",
    companyId,
    "accounts",
    accountId,
    "transactions",
    transactionId,
  );
}

// ── Accounts & transactions ─────────────────────────────────────────────

export async function createAccount({
  activeCompany,
  data,
  user,
}: {
  activeCompany: string;
  data: { name: string; accountType: string; balance: number };
  user: User | null;
}) {
  const batch = writeBatch(db);

  // 1️⃣ Add account
  const accountRef = doc(
    collection(db, "companies", activeCompany, "accounts"),
  );
  batch.set(accountRef, {
    name: data.name,
    initialBalance: data.balance,
    accountType: data.accountType,
    balance: data.balance,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });

  // 2️⃣ Add Audit Log
  const auditLogRef = doc(collection(db, "auditLogs"));
  batch.set(auditLogRef, {
    userId: user?.uid,
    action: "create",
    description: `Account created: ${data.name}`,
    companyId: activeCompany,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function addTransaction({
  activeCompany,
  data,
  user,
}: {
  activeCompany: string;
  data: TransactionFormValues;
  user: User | null;
}) {
  const batch = writeBatch(db);

  // Transactions
  const transactionId = doc(collection(db, "transactions")).id;

  const creditTransactionRef = doc(
    db,
    "companies",
    activeCompany,
    "accounts",
    data.creditingAccount,
    "transactions",
    transactionId,
  );

  batch.set(creditTransactionRef, {
    date: data.date,
    amount: data.amount,
    type: "credit",
    department: data.department,
    vehicle: data.vehicle,
    voucherNo: data.voucherNo,
    description: data.description,
    createdAt: serverTimestamp(),
  });

  const debitTransactionRef = doc(
    db,
    "companies",
    activeCompany,
    "accounts",
    data.debitingAccount,
    "transactions",
    transactionId,
  );

  batch.set(debitTransactionRef, {
    date: data.date,
    amount: data.amount,
    type: "debit",
    department: data.department,
    vehicle: data.vehicle,
    voucherNo: data.voucherNo,
    description: data.description,
    createdAt: serverTimestamp(),
  });

  // Accounts
  const creditAccountRef = doc(
    db,
    "companies",
    activeCompany,
    "accounts",
    data.creditingAccount,
  );
  batch.update(creditAccountRef, {
    balance: increment(data.amount),
  });

  const debitAccountRef = doc(
    db,
    "companies",
    activeCompany,
    "accounts",
    data.debitingAccount,
  );
  batch.update(debitAccountRef, {
    balance: increment(-data.amount),
  });

  // Audit Log
  appendAuditLog(batch, {
    userId: user?.uid,
    transactionId: transactionId,
    action: "create",
    description: `Transaction added`,
    companyId: activeCompany,
    entityStatus: true,
  });

  await batch.commit();
}

/** Reverses the original (tagged "corrected") and posts the corrected entry. */
export async function correctTransaction({
  activeCompany,
  data,
  transaction,
  user,
}: {
  activeCompany: string;
  data: TransactionFormValues;
  transaction: Transaction;
  user: User | null;
}) {
  const batch = writeBatch(db);
  const transactionId = transaction.id;

  const reversalTxId = doc(collection(db, "transactions")).id;
  const newTxId = doc(collection(db, "transactions")).id;
  const reversalDate = transaction.date || data.date;
  const reversalCreatedAt = Timestamp.fromMillis(Date.now());
  const correctedCreatedAt = Timestamp.fromMillis(Date.now() + 500);
  const balanceDeltas = new Map<string, number>();

  const addBalanceDelta = (accountId: string | undefined, delta: number) => {
    if (!accountId) return;
    balanceDeltas.set(accountId, (balanceDeltas.get(accountId) || 0) + delta);
  };

  // 1. Reverse the original transaction
  if (transaction.creditingAccountId) {
    const revDebitTxRef = doc(
      db,
      "companies",
      activeCompany,
      "accounts",
      transaction.creditingAccountId,
      "transactions",
      reversalTxId,
    );
    batch.set(revDebitTxRef, {
      date: reversalDate,
      amount: transaction.amount,
      type: "debit",
      department: transaction.department,
      vehicle: transaction.vehicle,
      voucherNo: transaction.voucher,
      description: `Reversal: ${transaction.description}`,
      tags: ["reversal"],
      createdAt: reversalCreatedAt,
    });

    addBalanceDelta(transaction.creditingAccountId, -transaction.amount);

    const oldCreditTxRef = doc(
      db,
      "companies",
      activeCompany,
      "accounts",
      transaction.creditingAccountId,
      "transactions",
      transactionId,
    );
    batch.update(oldCreditTxRef, {
      tags: arrayUnion("corrected"),
      updatedAt: reversalCreatedAt,
    });
  }

  if (transaction.debitingAccountId) {
    const revCreditTxRef = doc(
      db,
      "companies",
      activeCompany,
      "accounts",
      transaction.debitingAccountId,
      "transactions",
      reversalTxId,
    );
    batch.set(revCreditTxRef, {
      date: reversalDate,
      amount: transaction.amount,
      type: "credit",
      department: transaction.department,
      vehicle: transaction.vehicle,
      voucherNo: transaction.voucher,
      description: `Reversal: ${transaction.description}`,
      tags: ["reversal"],
      createdAt: reversalCreatedAt,
    });

    addBalanceDelta(transaction.debitingAccountId, transaction.amount);

    const oldDebitTxRef = doc(
      db,
      "companies",
      activeCompany,
      "accounts",
      transaction.debitingAccountId,
      "transactions",
      transactionId,
    );
    batch.update(oldDebitTxRef, {
      tags: arrayUnion("corrected"),
      updatedAt: reversalCreatedAt,
    });
  }

  // 2. Add the new transaction entry
  const newCreditTxRef = doc(
    db,
    "companies",
    activeCompany,
    "accounts",
    data.creditingAccount,
    "transactions",
    newTxId,
  );
  batch.set(newCreditTxRef, {
    date: data.date,
    amount: data.amount,
    type: "credit",
    department: data.department,
    vehicle: data.vehicle,
    voucherNo: data.voucherNo,
    description: data.description,
    createdAt: correctedCreatedAt,
  });

  addBalanceDelta(data.creditingAccount, data.amount);

  const newDebitTxRef = doc(
    db,
    "companies",
    activeCompany,
    "accounts",
    data.debitingAccount,
    "transactions",
    newTxId,
  );
  batch.set(newDebitTxRef, {
    date: data.date,
    amount: data.amount,
    type: "debit",
    department: data.department,
    vehicle: data.vehicle,
    voucherNo: data.voucherNo,
    description: data.description,
    createdAt: correctedCreatedAt,
  });

  addBalanceDelta(data.debitingAccount, -data.amount);

  // One balance write per account (coalesced deltas)
  for (const [accountId, delta] of balanceDeltas) {
    if (delta === 0) continue;
    batch.update(doc(db, "companies", activeCompany, "accounts", accountId), {
      balance: increment(delta),
    });
  }

  appendAuditLog(batch, {
    userId: user?.uid,
    transactionId: newTxId,
    action: "update-with-reversal",
    description: `Transaction reversed and updated`,
    companyId: activeCompany,
    entityStatus: true,
    createdAt: correctedCreatedAt,
  });

  await batch.commit();
}

/** Reverses the entry and tags the original "deleted". */
export async function deleteTransaction({
  activeCompany,
  transaction,
  user,
}: {
  activeCompany: string;
  transaction: Transaction;
  user: User | null;
}) {
  const batch = writeBatch(db);
  const transactionId = transaction.id;
  const reversalTxId = doc(collection(db, "transactions")).id;

  if (transaction.creditingAccountId) {
    const revDebitTxRef = doc(
      db,
      "companies",
      activeCompany,
      "accounts",
      transaction.creditingAccountId,
      "transactions",
      reversalTxId,
    );
    batch.set(revDebitTxRef, {
      date: transaction.date || new Date(),
      amount: transaction.amount,
      type: "debit",
      department: transaction.department,
      vehicle: transaction.vehicle,
      voucherNo: transaction.voucher,
      description: `Reversal: ${transaction.description}`,
      tags: ["reversal"],
      createdAt: serverTimestamp(),
    });

    const oldCreditAccountRef = doc(
      db,
      "companies",
      activeCompany,
      "accounts",
      transaction.creditingAccountId,
    );
    batch.update(oldCreditAccountRef, {
      balance: increment(-transaction.amount),
    });

    const oldCreditTxRef = doc(
      db,
      "companies",
      activeCompany,
      "accounts",
      transaction.creditingAccountId,
      "transactions",
      transactionId,
    );
    batch.update(oldCreditTxRef, {
      tags: arrayUnion("deleted"),
      updatedAt: serverTimestamp(),
    });
  }

  if (transaction.debitingAccountId) {
    const revCreditTxRef = doc(
      db,
      "companies",
      activeCompany,
      "accounts",
      transaction.debitingAccountId,
      "transactions",
      reversalTxId,
    );
    batch.set(revCreditTxRef, {
      date: transaction.date || new Date(),
      amount: transaction.amount,
      type: "credit",
      department: transaction.department,
      vehicle: transaction.vehicle,
      voucherNo: transaction.voucher,
      description: `Reversal: ${transaction.description}`,
      tags: ["reversal"],
      createdAt: serverTimestamp(),
    });

    const oldDebitAccountRef = doc(
      db,
      "companies",
      activeCompany,
      "accounts",
      transaction.debitingAccountId,
    );
    batch.update(oldDebitAccountRef, {
      balance: increment(transaction.amount),
    });

    const oldDebitTxRef = doc(
      db,
      "companies",
      activeCompany,
      "accounts",
      transaction.debitingAccountId,
      "transactions",
      transactionId,
    );
    batch.update(oldDebitTxRef, {
      tags: arrayUnion("deleted"),
      updatedAt: serverTimestamp(),
    });
  }

  // Audit log for the edits
  appendAuditLog(batch, {
    userId: user?.uid,
    transactionId: reversalTxId,
    action: "delete",
    description: `Transaction deleted and reversed`,
    companyId: activeCompany,
    entityStatus: false,
  });

  await batch.commit();
}

// ── Client invoices ─────────────────────────────────────────────────────

export async function completeInvoice({
  activeCompany,
  clientId,
  invoice,
  user,
}: {
  activeCompany: string;
  clientId: string;
  invoice: ClientInvoiceDocument;
  user: User;
}) {
  const batch = writeBatch(db);
  const invoiceRef = doc(
    db,
    "companies",
    activeCompany,
    "clients",
    clientId,
    "invoices",
    invoice.id,
  );

  batch.update(invoiceRef, {
    status: "paid",
    outstandingAmount: 0,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  const auditRef = doc(collection(db, "auditLogs"));
  batch.set(auditRef, {
    userId: user.uid,
    companyId: activeCompany,
    action: "update",
    description: `Invoice ${invoice.taxInvoiceNo} marked as completed/paid`,
    entityStatus: true,
    transactionId: invoice.id,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function deleteInvoice({
  activeCompany,
  clientId,
  invoiceId,
  taxInvoiceNo,
  user,
}: {
  activeCompany: string;
  clientId: string;
  invoiceId: string;
  taxInvoiceNo?: string;
  user: User;
}) {
  const batch = writeBatch(db);
  const invoiceRef = doc(
    db,
    "companies",
    activeCompany,
    "clients",
    clientId,
    "invoices",
    invoiceId,
  );
  batch.update(invoiceRef, {
    entityStatus: false,
    status: "cancelled",
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  const auditRef = doc(collection(db, "auditLogs"));
  batch.set(auditRef, {
    userId: user.uid,
    companyId: activeCompany,
    action: "delete",
    description: `Invoice ${taxInvoiceNo || invoiceId} deleted`,
    entityStatus: true,
    transactionId: invoiceId,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function deleteInvoicePayment({
  activeCompany,
  clientId,
  invoice,
  payment,
  outstandingAmount,
  user,
}: {
  activeCompany: string;
  clientId: string;
  invoice: ClientInvoiceDocument;
  payment: InvoicePayment;
  outstandingAmount?: number;
  user: User;
}) {
  const batch = writeBatch(db);
  const invoiceRef = doc(
    db,
    "companies",
    activeCompany,
    "clients",
    clientId,
    "invoices",
    invoice.id,
  );
  const paymentRef = doc(invoiceRef, "payments", payment.id);
  const currentOutstanding = roundMoney(
    outstandingAmount ?? invoice.outstandingAmount,
  );
  const nextOutstanding = roundMoney(currentOutstanding + payment.amount);
  const nextStatus =
    invoice.status === "paid"
      ? deriveStatusFromBalances(
          invoice.totalIncludingVat,
          nextOutstanding,
          "partial",
        )
      : deriveStatusFromBalances(
          invoice.totalIncludingVat,
          nextOutstanding,
          invoice.status,
        );

  batch.update(paymentRef, {
    entityStatus: false,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  batch.update(invoiceRef, {
    outstandingAmount: nextOutstanding,
    status: nextStatus,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  if (payment.transactionId && payment.creditingAccountId) {
    batch.delete(
      doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        payment.creditingAccountId,
        "transactions",
        payment.transactionId,
      ),
    );
    batch.update(
      doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        payment.creditingAccountId,
      ),
      { balance: increment(-payment.amount) },
    );
  }

  if (payment.transactionId && payment.debitingAccountId) {
    batch.delete(
      doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        payment.debitingAccountId,
        "transactions",
        payment.transactionId,
      ),
    );
    batch.update(
      doc(
        db,
        "companies",
        activeCompany,
        "accounts",
        payment.debitingAccountId,
      ),
      { balance: increment(payment.amount) },
    );
  }

  const auditRef = doc(collection(db, "auditLogs"));
  batch.set(auditRef, {
    userId: user.uid,
    companyId: activeCompany,
    action: "delete",
    description: `Payment of ${payment.amount} removed from invoice ${invoice.taxInvoiceNo}`,
    entityStatus: true,
    transactionId: payment.transactionId || payment.id,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function saveInvoicePayment({
  activeCompany,
  clientId,
  invoice,
  payment,
  outstanding,
  paymentAmount,
  date,
  description,
  chequeNo,
  creditAccount,
  debitAccount,
  user,
}: {
  activeCompany: string;
  clientId: string;
  invoice: ClientInvoiceDocument;
  payment?: InvoicePayment;
  outstanding: number;
  paymentAmount: number;
  date: string;
  description: string;
  chequeNo: string;
  creditAccount: Account;
  debitAccount: Account;
  user: User;
}) {
  const isEditing = !!payment;
  const batch = writeBatch(db);
  const invoiceRef = doc(
    db,
    "companies",
    activeCompany,
    "clients",
    clientId,
    "invoices",
    invoice.id,
  );
  const paymentRef = isEditing
    ? doc(invoiceRef, "payments", payment.id)
    : doc(collection(invoiceRef, "payments"));

  const nextOutstanding = isEditing
    ? roundMoney(outstanding + payment.amount - paymentAmount)
    : roundMoney(outstanding - paymentAmount);
  const nextStatus = deriveStatusFromBalances(
    invoice.totalIncludingVat,
    nextOutstanding,
    invoice.status === "paid" ? "partial" : invoice.status,
  );

  const paymentDate = Timestamp.fromDate(new Date(`${date}T00:00:00`));
  const txDescription = description.trim();
  const trimmedChequeNo = chequeNo.trim();
  const transactionId =
    (isEditing && payment.transactionId) ||
    doc(collection(db, "transactions")).id;

  const txPayload = {
    date: paymentDate,
    amount: paymentAmount,
    department: "",
    vehicle: "",
    voucherNo: 0,
    description: txDescription,
    tags: ["invoice-payment", invoice.taxInvoiceNo],
    invoiceId: invoice.id,
    invoiceNo: invoice.taxInvoiceNo,
    chequeNo: trimmedChequeNo,
    clientId,
    clientName: invoice.client.name,
    paymentId: paymentRef.id,
  };

  if (isEditing && payment.transactionId) {
    const previousCreditId = payment.creditingAccountId;
    const previousDebitId = payment.debitingAccountId || debitAccount.id;
    const previousAmount = payment.amount;

    // Reverse previous balances, then apply the new ones.
    if (previousCreditId) {
      batch.update(
        doc(db, "companies", activeCompany, "accounts", previousCreditId),
        {
          balance: increment(-previousAmount),
        },
      );
    }
    if (previousDebitId) {
      batch.update(
        doc(db, "companies", activeCompany, "accounts", previousDebitId),
        {
          balance: increment(previousAmount),
        },
      );
    }

    // Remove old transaction docs if the account changed.
    if (previousCreditId && previousCreditId !== creditAccount.id) {
      batch.delete(
        accountTxRef(activeCompany, previousCreditId, payment.transactionId),
      );
    }
    if (previousDebitId && previousDebitId !== debitAccount.id) {
      batch.delete(
        accountTxRef(activeCompany, previousDebitId, payment.transactionId),
      );
    }

    batch.set(
      accountTxRef(activeCompany, creditAccount.id, transactionId),
      {
        ...txPayload,
        type: "credit",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    batch.set(
      accountTxRef(activeCompany, debitAccount.id, transactionId),
      {
        ...txPayload,
        type: "debit",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );

    batch.update(
      doc(db, "companies", activeCompany, "accounts", creditAccount.id),
      {
        balance: increment(paymentAmount),
      },
    );
    batch.update(
      doc(db, "companies", activeCompany, "accounts", debitAccount.id),
      {
        balance: increment(-paymentAmount),
      },
    );
  } else {
    batch.set(accountTxRef(activeCompany, creditAccount.id, transactionId), {
      ...txPayload,
      type: "credit",
      createdAt: serverTimestamp(),
    });
    batch.set(accountTxRef(activeCompany, debitAccount.id, transactionId), {
      ...txPayload,
      type: "debit",
      createdAt: serverTimestamp(),
    });
    batch.update(
      doc(db, "companies", activeCompany, "accounts", creditAccount.id),
      {
        balance: increment(paymentAmount),
      },
    );
    batch.update(
      doc(db, "companies", activeCompany, "accounts", debitAccount.id),
      {
        balance: increment(-paymentAmount),
      },
    );
  }

  const payload = {
    date: paymentDate,
    description: txDescription,
    chequeNo: trimmedChequeNo,
    amount: paymentAmount,
    creditingAccountId: creditAccount.id,
    creditingAccountName: creditAccount.name,
    debitingAccountId: debitAccount.id,
    debitingAccountName: debitAccount.name,
    transactionId,
    entityStatus: true,
  };

  if (isEditing) {
    batch.update(paymentRef, {
      ...payload,
      invoiceNo: deleteField(),
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  } else {
    batch.set(paymentRef, {
      ...payload,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
  }

  batch.update(invoiceRef, {
    outstandingAmount: Math.max(0, nextOutstanding),
    status: nextStatus,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  const auditRef = doc(collection(db, "auditLogs"));
  batch.set(auditRef, {
    userId: user.uid,
    companyId: activeCompany,
    action: isEditing ? "update" : "create",
    description: isEditing
      ? `Payment on invoice ${invoice.taxInvoiceNo} updated`
      : `Payment of ${paymentAmount} added to invoice ${invoice.taxInvoiceNo}`,
    entityStatus: true,
    transactionId,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function saveTemplate({
  activeCompany,
  clientId,
  clientName,
  company,
  draft,
  template,
  user,
}: {
  activeCompany: string;
  clientId: string;
  clientName: string;
  company: CompanyRecord | null;
  draft: InvoiceTemplate;
  template: InvoiceTemplate | null;
  user: User;
}) {
  const batch = writeBatch(db);
  const templateRef = doc(
    db,
    "companies",
    activeCompany,
    "clients",
    clientId,
    "invoice-template",
    "config",
  );
  const payload = withCompanySupplier(draft, company);
  batch.set(
    templateRef,
    {
      ...payload,
      clientId,
      entityStatus: true,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
      ...(!template
        ? { createdAt: serverTimestamp(), createdBy: user.uid }
        : {}),
    },
    { merge: true },
  );

  const auditRef = doc(collection(db, "auditLogs"));
  batch.set(auditRef, {
    userId: user.uid,
    companyId: activeCompany,
    action: template ? "update" : "create",
    description: `${template ? "Invoice template updated" : "Invoice template created"}: ${clientName}`,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

// ── Suppliers ───────────────────────────────────────────────────────────

export async function createSupplier({
  activeCompany,
  data,
  user,
}: {
  activeCompany: string;
  data: SupplierFormValues;
  user: User;
}) {
  const accountTypes = useLookupStore.getState().accountTypes;
  const batch = writeBatch(db);
  const name = data.name.trim();
  const supplierRef = doc(
    collection(db, "companies", activeCompany, "suppliers"),
  );
  batch.set(supplierRef, {
    name,
    tin: data.tin.trim(),
    address: data.address.trim(),
    supplierType: data.supplierType,
    contactNo: data.contactNo.trim(),
    status: "active",
    entityStatus: true,
    createdAt: serverTimestamp(),
  });

  // The system "Supplier" account type backs every supplier account.
  const supplierType = accountTypes.find((type) =>
    isSupplierAccountTypeName(type.name),
  );
  if (!supplierType) {
    batch.set(
      doc(collection(db, "lookup-lists", activeCompany, "account-types")),
      {
        name: SUPPLIER_ACCOUNT_TYPE_NAME,
        shortForm: SUPPLIER_ACCOUNT_TYPE_SHORT_FORM,
        isSystem: true,
        entityStatus: true,
        createdAt: serverTimestamp(),
      },
    );
  } else if (!supplierType.isSystem) {
    batch.update(
      doc(db, "lookup-lists", activeCompany, "account-types", supplierType.id),
      { isSystem: true, updatedAt: serverTimestamp() },
    );
  }

  batch.set(doc(collection(db, "companies", activeCompany, "accounts")), {
    name,
    accountType: SUPPLIER_ACCOUNT_TYPE_NAME,
    initialBalance: 0,
    balance: 0,
    supplierId: supplierRef.id,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });

  appendAuditLog(batch, {
    userId: user.uid,
    companyId: activeCompany,
    action: "create",
    description: `Supplier created: ${name} (with supplier account)`,
  });

  await batch.commit();
}

export async function updateSupplier({
  activeCompany,
  data,
  supplier,
  user,
}: {
  activeCompany: string;
  data: SupplierFormValues;
  supplier: Supplier;
  user: User;
}) {
  const batch = writeBatch(db);
  const name = data.name.trim();
  batch.update(doc(db, "companies", activeCompany, "suppliers", supplier.id), {
    name,
    tin: data.tin.trim(),
    address: data.address.trim(),
    supplierType: data.supplierType,
    contactNo: data.contactNo.trim(),
    updatedAt: serverTimestamp(),
  });
  if (name !== supplier.name.trim()) {
    const accounts = await getDocs(
      query(
        collection(db, "companies", activeCompany, "accounts"),
        where("supplierId", "==", supplier.id),
      ),
    );
    for (const account of accounts.docs) {
      batch.update(account.ref, { name, updatedAt: serverTimestamp() });
    }
  }
  appendAuditLog(batch, {
    userId: user.uid,
    companyId: activeCompany,
    action: "update",
    description: `Supplier updated: ${name}`,
  });
  await batch.commit();
}

export async function setSupplierStatus({
  activeCompany,
  supplier,
  nextStatus,
  user,
}: {
  activeCompany: string;
  supplier: Supplier;
  nextStatus: "active" | "inactive";
  user: User;
}) {
  const batch = writeBatch(db);
  batch.update(doc(db, "companies", activeCompany, "suppliers", supplier.id), {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  });
  appendAuditLog(batch, {
    userId: user.uid,
    companyId: activeCompany,
    action: "update",
    description: `Supplier status changed to ${nextStatus}: ${supplier.name}`,
  });
  await batch.commit();
}
