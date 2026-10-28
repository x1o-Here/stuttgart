"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import { toDate } from "@/lib/helpers/to-date";
import {
  computeVatQuarters,
  type VatPaymentRecord,
  type VatSourceInvoice,
} from "@/lib/vat/vat-summary";

type Party = { id: string; name: string };
type Side = "clients" | "suppliers";

// Client invoices that are drafts or cancelled carry no output VAT.
const EXCLUDED_CLIENT_STATUSES = new Set(["draft", "cancelled"]);

/** Live list of a company's active clients or suppliers (id + name). */
function useParties(side: Side) {
  const { activeCompany } = useAuth();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    return onSnapshot(
      collection(db, "companies", activeCompany, side),
      (snapshot) => {
        setParties(
          snapshot.docs
            .filter((d) => d.data().entityStatus !== false)
            .map((d) => ({ id: d.id, name: (d.data().name as string) ?? "" })),
        );
        setLoading(false);
      },
      (error) => {
        console.error(`Failed to load ${side} for VAT:`, error);
        setLoading(false);
      },
    );
  }, [activeCompany, side]);

  return { parties, loading };
}

/** Live VAT-bearing invoices for every client or supplier. */
function useSideInvoices(side: Side, parties: Party[]) {
  const { activeCompany } = useAuth();
  const [byParty, setByParty] = useState<Record<string, VatSourceInvoice[]>>(
    {},
  );
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const key = parties.map((p) => `${p.id}:${p.name}`).join("|");

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` encodes parties
  useEffect(() => {
    if (!activeCompany) return;
    setByParty({});
    setLoaded(new Set());
    const unsubs = parties.map((party) =>
      onSnapshot(
        collection(db, "companies", activeCompany, side, party.id, "invoices"),
        (snapshot) => {
          const invoices: VatSourceInvoice[] = [];
          for (const d of snapshot.docs) {
            const data = d.data();
            if (data.entityStatus === false) continue;
            if (
              side === "clients" &&
              EXCLUDED_CLIENT_STATUSES.has(String(data.status))
            ) {
              continue;
            }
            const vatAmount = Number(data.vatAmount) || 0;
            if (vatAmount === 0) continue;
            invoices.push({
              id: d.id,
              date: toDate(data.date) ?? new Date(0),
              vatAmount,
              invoiceNo:
                (data.taxInvoiceNo as string) ||
                (data.invoiceNo as string) ||
                "–",
              partyName: party.name,
              href: `/${side}/${party.id}/invoices/${d.id}`,
            });
          }
          setByParty((current) => ({ ...current, [party.id]: invoices }));
          setLoaded((current) => new Set(current).add(party.id));
        },
        (error) => {
          console.error(`Failed to load ${side} invoices for VAT:`, error);
          setLoaded((current) => new Set(current).add(party.id));
        },
      ),
    );
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [activeCompany, side, key]);

  const invoices = useMemo(() => Object.values(byParty).flat(), [byParty]);
  const loading = parties.some((party) => !loaded.has(party.id));
  return { invoices, loading };
}

function useVatPayments() {
  const { activeCompany } = useAuth();
  const [payments, setPayments] = useState<VatPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    return onSnapshot(
      collection(db, "companies", activeCompany, "vatPayments"),
      (snapshot) => {
        setPayments(
          snapshot.docs
            .filter((d) => d.data().entityStatus !== false)
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                quarterKey: String(data.quarterKey ?? ""),
                date: toDate(data.date) ?? new Date(0),
                amount: Number(data.amount) || 0,
                reference: String(data.reference ?? ""),
                accountId: String(data.accountId ?? ""),
                accountName: String(data.accountName ?? ""),
                transactionId: String(data.transactionId ?? ""),
              };
            }),
        );
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load VAT payments:", error);
        setLoading(false);
      },
    );
  }, [activeCompany]);

  return { payments, loading };
}

/**
 * Quarterly VAT position: output VAT from client invoices, input VAT from
 * supplier invoices, and VAT already paid — recalculated live.
 */
export function useVatLedger() {
  const clients = useParties("clients");
  const suppliers = useParties("suppliers");
  const outgoing = useSideInvoices("clients", clients.parties);
  const incoming = useSideInvoices("suppliers", suppliers.parties);
  const vatPayments = useVatPayments();

  const summary = useMemo(
    () =>
      computeVatQuarters(
        outgoing.invoices,
        incoming.invoices,
        vatPayments.payments,
      ),
    [outgoing.invoices, incoming.invoices, vatPayments.payments],
  );

  return {
    ...summary,
    loading:
      clients.loading ||
      suppliers.loading ||
      outgoing.loading ||
      incoming.loading ||
      vatPayments.loading,
  };
}
