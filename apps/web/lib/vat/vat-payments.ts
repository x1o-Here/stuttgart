import {
  collection,
  doc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase-client";
import { roundMoney } from "@/lib/invoices/money";
import type { TaxQuarter } from "./quarters";
import type { VatPaymentRecord } from "./vat-summary";

export class VatPaymentError extends Error {}

const paymentsCol = (c: string) =>
  collection(db, "companies", c, "vatPayments");
const accountRef = (c: string, a: string) =>
  doc(db, "companies", c, "accounts", a);
const accountTxRef = (c: string, a: string, t: string) =>
  doc(db, "companies", c, "accounts", a, "transactions", t);

const lkr = (value: number) =>
  `LKR ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Records a VAT payment to the tax authority for one quarter and posts it to
 * the ledger: the paying account is debited (balance goes down).
 */
export async function recordVatPayment(
  companyId: string,
  userId: string,
  input: {
    quarter: TaxQuarter;
    /** VAT due for the quarter (output − input), used for the cap. */
    due: number;
    date: Date;
    amount: number;
    reference: string;
    account: { id: string; name: string };
  },
) {
  const amount = roundMoney(input.amount);
  if (!(amount > 0)) {
    throw new VatPaymentError("Enter an amount greater than zero.");
  }

  // Re-read what's already paid for this quarter so the cap is current.
  const existing = await getDocs(
    query(paymentsCol(companyId), where("quarterKey", "==", input.quarter.key)),
  );
  const alreadyPaid = roundMoney(
    existing.docs
      .filter((d) => d.data().entityStatus !== false)
      .reduce((sum, d) => sum + (Number(d.data().amount) || 0), 0),
  );
  const remaining = roundMoney(Math.max(0, input.due) - alreadyPaid);
  if (amount > remaining) {
    throw new VatPaymentError(
      remaining > 0
        ? `Only ${lkr(remaining)} is still payable for ${input.quarter.label}.`
        : `${input.quarter.label} is already fully paid.`,
    );
  }

  const paymentRef = doc(paymentsCol(companyId));
  const transactionId = doc(collection(db, "transactions")).id;
  const reference = input.reference.trim();
  const description = `VAT payment ${input.quarter.label}${reference ? ` · ${reference}` : ""}`;

  await runTransaction(db, async (tx) => {
    const account = await tx.get(accountRef(companyId, input.account.id));
    if (!account.exists()) {
      throw new VatPaymentError("The paying account no longer exists.");
    }
    const date = Timestamp.fromDate(input.date);
    tx.set(paymentRef, {
      quarterKey: input.quarter.key,
      quarterLabel: input.quarter.label,
      date,
      amount,
      reference,
      accountId: input.account.id,
      accountName: input.account.name,
      transactionId,
      entityStatus: true,
      createdAt: serverTimestamp(),
      createdBy: userId,
    });
    tx.set(accountTxRef(companyId, input.account.id, transactionId), {
      date,
      amount,
      type: "debit",
      department: "",
      vehicle: "",
      voucherNo: 0,
      description,
      tags: ["vat-payment", input.quarter.label],
      vatPaymentId: paymentRef.id,
      createdAt: serverTimestamp(),
    });
    tx.update(accountRef(companyId, input.account.id), {
      balance: increment(-amount),
    });
    tx.set(doc(collection(db, "auditLogs")), {
      userId,
      companyId,
      action: "create",
      description: `${description}: ${lkr(amount)} from ${input.account.name}`,
      entityStatus: true,
      createdAt: serverTimestamp(),
    });
  });
}

/** Removes a VAT payment and reverses its ledger entry. */
export async function deleteVatPayment(
  companyId: string,
  userId: string,
  payment: VatPaymentRecord & { quarterLabel: string },
) {
  await runTransaction(db, async (tx) => {
    tx.update(doc(paymentsCol(companyId), payment.id), {
      entityStatus: false,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    if (payment.accountId && payment.transactionId) {
      tx.delete(
        accountTxRef(companyId, payment.accountId, payment.transactionId),
      );
      tx.update(accountRef(companyId, payment.accountId), {
        balance: increment(payment.amount),
      });
    }
    tx.set(doc(collection(db, "auditLogs")), {
      userId,
      companyId,
      action: "delete",
      description: `VAT payment ${payment.quarterLabel} of ${lkr(payment.amount)} deleted and returned to ${payment.accountName}`,
      entityStatus: true,
      createdAt: serverTimestamp(),
    });
  });
}
