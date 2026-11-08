/**
 * Clients on Firestore: the code that used to live in the client screens,
 * moved here unchanged in behaviour. Deleted after the cutover (Phase 7).
 */
import {
  collection,
  type DocumentData,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  CLIENT_ACCOUNT_TYPE_NAME,
  CLIENT_ACCOUNT_TYPE_SHORT_FORM,
  isClientAccountTypeName,
} from "@/lib/constants/client-account";
import { db } from "@/lib/firebase/firebase-client";
import { roundMoney } from "@/lib/invoices/money";
import { useLookupStore } from "@/stores/use-lookup-store";
import type { Client, ClientInput, ClientStatus } from "./types";

type InvoiceStats = Pick<
  Client,
  "activeInvoiceCount" | "outstandingInvoiceAmount"
>;
const NO_INVOICES: InvoiceStats = {
  activeInvoiceCount: 0,
  outstandingInvoiceAmount: 0,
};

function mapClient(id: string, data: DocumentData): Client | null {
  if (data.entityStatus === false) return null;
  return {
    id,
    name: typeof data.name === "string" ? data.name : "Unnamed Client",
    address: typeof data.address === "string" ? data.address : "",
    vatNo: typeof data.vatNo === "string" ? data.vatNo : "",
    contactNo: typeof data.contactNo === "string" ? data.contactNo : "",
    status: data.status === "inactive" ? "inactive" : "active",
    ...NO_INVOICES,
  };
}

function invoiceOutstanding(data: DocumentData): number {
  if (data.outstandingAmount !== undefined && data.outstandingAmount !== null) {
    return Number(data.outstandingAmount) || 0;
  }
  if (data.totalIncludingVat !== undefined && data.totalIncludingVat !== null) {
    return Number(data.totalIncludingVat) || 0;
  }
  return Number(data.totalAmount) || 0;
}

/** Open invoices = not paid or cancelled (unknown statuses count as issued). */
function aggregateInvoiceStats(invoices: DocumentData[]): InvoiceStats {
  let activeInvoiceCount = 0;
  let outstanding = 0;
  for (const data of invoices) {
    if (data.entityStatus === false) continue;
    if (data.status === "paid" || data.status === "cancelled") continue;
    activeInvoiceCount += 1;
    outstanding += invoiceOutstanding(data);
  }
  return {
    activeInvoiceCount,
    outstandingInvoiceAmount: roundMoney(outstanding),
  };
}

/** Live list of the company's clients with their open-invoice totals. */
export function subscribeClients(
  companyId: string,
  onData: (clients: Client[]) => void,
): () => void {
  let clients: Client[] = [];
  const stats = new Map<string, InvoiceStats>();
  const invoiceListeners = new Map<string, () => void>();

  const emit = () =>
    onData(
      clients.map((client) => ({
        ...client,
        ...(stats.get(client.id) ?? NO_INVOICES),
      })),
    );

  const stopClients = onSnapshot(
    query(
      collection(db, "companies", companyId, "clients"),
      orderBy("createdAt", "desc"),
    ),
    (snapshot) => {
      clients = snapshot.docs
        .map((d) => mapClient(d.id, d.data()))
        .filter((client): client is Client => client !== null);

      // One invoice listener per client; drop listeners for removed clients.
      const ids = new Set(clients.map((client) => client.id));
      for (const [id, stop] of invoiceListeners) {
        if (ids.has(id)) continue;
        stop();
        invoiceListeners.delete(id);
        stats.delete(id);
      }
      for (const id of ids) {
        if (invoiceListeners.has(id)) continue;
        invoiceListeners.set(
          id,
          onSnapshot(
            collection(db, "companies", companyId, "clients", id, "invoices"),
            (invoices) => {
              stats.set(
                id,
                aggregateInvoiceStats(invoices.docs.map((d) => d.data())),
              );
              emit();
            },
            (error) => {
              console.error(
                `Failed to fetch invoices for client ${id}:`,
                error,
              );
              stats.set(id, NO_INVOICES);
              emit();
            },
          ),
        );
      }
      emit();
    },
    (error) => {
      console.error("Failed to fetch clients:", error);
      onData([]);
    },
  );

  return () => {
    stopClients();
    for (const stop of invoiceListeners.values()) stop();
  };
}

/** Live single client; emits null when it doesn't exist or was deleted. */
export function subscribeClient(
  companyId: string,
  id: string,
  onData: (client: Client | null) => void,
): () => void {
  return onSnapshot(
    doc(db, "companies", companyId, "clients", id),
    (snapshot) =>
      onData(
        snapshot.exists() ? mapClient(snapshot.id, snapshot.data()) : null,
      ),
    (error) => {
      console.error("Failed to fetch client:", error);
      onData(null);
    },
  );
}

/** Client + system "Client" account type (if needed) + client account + audit entries. */
export async function createClient(
  companyId: string,
  userId: string,
  input: ClientInput,
): Promise<void> {
  const batch = writeBatch(db);
  const clientName = input.name.trim();

  const clientRef = doc(collection(db, "companies", companyId, "clients"));
  batch.set(clientRef, {
    name: clientName,
    address: input.address,
    vatNo: input.vatNo,
    contactNo: input.contactNo,
    status: "active",
    entityStatus: true,
    createdAt: serverTimestamp(),
  });

  const existingClientType = useLookupStore
    .getState()
    .accountTypes.find((type) => isClientAccountTypeName(type.name));
  if (!existingClientType) {
    batch.set(doc(collection(db, "lookup-lists", companyId, "account-types")), {
      name: CLIENT_ACCOUNT_TYPE_NAME,
      shortForm: CLIENT_ACCOUNT_TYPE_SHORT_FORM,
      isSystem: true,
      entityStatus: true,
      createdAt: serverTimestamp(),
    });
  } else if (!existingClientType.isSystem) {
    batch.update(
      doc(
        db,
        "lookup-lists",
        companyId,
        "account-types",
        existingClientType.id,
      ),
      { isSystem: true, updatedAt: serverTimestamp() },
    );
  }

  batch.set(doc(collection(db, "companies", companyId, "accounts")), {
    name: clientName,
    accountType: CLIENT_ACCOUNT_TYPE_NAME,
    initialBalance: 0,
    balance: 0,
    clientId: clientRef.id,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });

  for (const description of [
    `Client created: ${clientName}`,
    `Client account created: ${clientName}`,
  ]) {
    batch.set(doc(collection(db, "auditLogs")), {
      userId,
      action: "create",
      description,
      companyId,
      entityStatus: true,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

/** Updates the client; renaming it also renames its linked account. */
export async function updateClient(
  companyId: string,
  userId: string,
  id: string,
  input: ClientInput,
  previousName: string,
): Promise<void> {
  const batch = writeBatch(db);
  const clientName = input.name.trim();

  batch.update(doc(db, "companies", companyId, "clients", id), {
    name: clientName,
    address: input.address,
    vatNo: input.vatNo,
    contactNo: input.contactNo,
    updatedAt: serverTimestamp(),
  });

  if (clientName !== previousName.trim()) {
    const accounts = await getDocs(
      query(
        collection(db, "companies", companyId, "accounts"),
        where("clientId", "==", id),
      ),
    );
    for (const account of accounts.docs) {
      batch.update(account.ref, {
        name: clientName,
        updatedAt: serverTimestamp(),
      });
    }
  }

  batch.set(doc(collection(db, "auditLogs")), {
    userId,
    action: "update",
    description: `Client updated: ${clientName}`,
    companyId,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function setClientStatus(
  companyId: string,
  userId: string,
  id: string,
  clientName: string,
  status: ClientStatus,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "companies", companyId, "clients", id), {
    status,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, "auditLogs")), {
    userId,
    action: "update",
    description: `Client status changed to ${status}: ${clientName}`,
    companyId,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}
