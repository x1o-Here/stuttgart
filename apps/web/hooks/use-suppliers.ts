"use client";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  type InvoicePayment,
  mapInvoicePayment,
} from "@/app/(main)/clients/[id]/invoice-model";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import {
  mapSupplierDoc,
  mapSupplierInvoice,
  type Supplier,
  type SupplierInvoice,
} from "@/lib/suppliers/supplier-model";

/** All active suppliers of the company, newest first. */
export function useSuppliers() {
  const { activeCompany } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    return onSnapshot(
      query(
        collection(db, "companies", activeCompany, "suppliers"),
        orderBy("createdAt", "desc"),
      ),
      (snapshot) => {
        setSuppliers(
          snapshot.docs
            .filter((d) => d.data().entityStatus !== false)
            .map((d) => mapSupplierDoc(d.id, d.data())),
        );
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load suppliers:", error);
        setLoading(false);
      },
    );
  }, [activeCompany]);

  return { suppliers, loading };
}

export function useSupplier(supplierId: string | undefined) {
  const { activeCompany } = useAuth();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany || !supplierId) return;
    setLoading(true);
    return onSnapshot(
      doc(db, "companies", activeCompany, "suppliers", supplierId),
      (snap) => {
        setSupplier(
          snap.exists() && snap.data().entityStatus !== false
            ? mapSupplierDoc(snap.id, snap.data())
            : null,
        );
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load supplier:", error);
        setSupplier(null);
        setLoading(false);
      },
    );
  }, [activeCompany, supplierId]);

  return { supplier, loading };
}

/** Active invoices of one supplier, newest first. */
export function useSupplierInvoices(supplierId: string | undefined) {
  const { activeCompany } = useAuth();
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany || !supplierId) return;
    setLoading(true);
    return onSnapshot(
      query(
        collection(
          db,
          "companies",
          activeCompany,
          "suppliers",
          supplierId,
          "invoices",
        ),
        orderBy("date", "desc"),
      ),
      (snapshot) => {
        setInvoices(
          snapshot.docs
            .filter((d) => d.data().entityStatus !== false)
            .map((d) => mapSupplierInvoice(supplierId, d.id, d.data())),
        );
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load supplier invoices:", error);
        setLoading(false);
      },
    );
  }, [activeCompany, supplierId]);

  return { invoices, loading };
}

export function useSupplierInvoice(
  supplierId: string | undefined,
  invoiceId: string | undefined,
) {
  const { activeCompany } = useAuth();
  const [invoice, setInvoice] = useState<SupplierInvoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany || !supplierId || !invoiceId) return;
    setLoading(true);
    return onSnapshot(
      doc(
        db,
        "companies",
        activeCompany,
        "suppliers",
        supplierId,
        "invoices",
        invoiceId,
      ),
      (snap) => {
        setInvoice(
          snap.exists() && snap.data().entityStatus !== false
            ? mapSupplierInvoice(supplierId, snap.id, snap.data())
            : null,
        );
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load supplier invoice:", error);
        setInvoice(null);
        setLoading(false);
      },
    );
  }, [activeCompany, supplierId, invoiceId]);

  return { invoice, loading };
}

export function useSupplierPayments(
  supplierId: string | undefined,
  invoiceId: string | undefined,
) {
  const { activeCompany } = useAuth();
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany || !supplierId || !invoiceId) return;
    setLoading(true);
    return onSnapshot(
      query(
        collection(
          db,
          "companies",
          activeCompany,
          "suppliers",
          supplierId,
          "invoices",
          invoiceId,
          "payments",
        ),
        orderBy("date", "desc"),
      ),
      (snapshot) => {
        setPayments(
          snapshot.docs
            .filter((d) => d.data().entityStatus !== false)
            .map((d) => mapInvoicePayment(d.id, d.data())),
        );
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load supplier payments:", error);
        setLoading(false);
      },
    );
  }, [activeCompany, supplierId, invoiceId]);

  const paidAmount = useMemo(
    () => payments.reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  );

  return { payments, paidAmount, loading };
}

/** Invoice totals per supplier (open count + outstanding), live. */
export function useSupplierInvoiceStats(supplierIds: string[]) {
  const { activeCompany } = useAuth();
  const [stats, setStats] = useState<
    Record<string, { openInvoices: number; outstanding: number }>
  >({});
  const key = supplierIds.join("|");

  useEffect(() => {
    if (!activeCompany || !key) {
      setStats({});
      return;
    }
    const unsubs = key.split("|").map((supplierId) =>
      onSnapshot(
        collection(
          db,
          "companies",
          activeCompany,
          "suppliers",
          supplierId,
          "invoices",
        ),
        (snapshot) => {
          let openInvoices = 0;
          let outstanding = 0;
          for (const d of snapshot.docs) {
            const data = d.data();
            if (data.entityStatus === false) continue;
            const amount = Number(data.outstandingAmount) || 0;
            if (amount > 0) {
              openInvoices += 1;
              outstanding += amount;
            }
          }
          setStats((current) => ({
            ...current,
            [supplierId]: {
              openInvoices,
              outstanding: Math.round(outstanding * 100) / 100,
            },
          }));
        },
        (error) =>
          console.error(`Failed to load invoices for ${supplierId}:`, error),
      ),
    );
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [activeCompany, key]);

  return stats;
}
