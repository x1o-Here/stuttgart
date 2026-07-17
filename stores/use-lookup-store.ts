"use client";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { create } from "zustand";
import { db } from "@/lib/firebase/firebase-client";
import { toDate } from "@/lib/helpers/to-date";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LookupItem = {
  id: string;
  name: string;
  shortForm?: string;
  entityStatus: boolean;
  createdAt?: Date;
};

export type CollectionKey = "account-types" | "vehicles" | "departments";

type LookupState = {
  accountTypes: LookupItem[];
  vehicles: LookupItem[];
  departments: LookupItem[];
  loading: Record<CollectionKey, boolean>;
  error: Record<CollectionKey, string | null>;

  // Real-time subscriptions
  subscribeAll: (companyId: string, userId: string) => () => void;

  // Generic CRUD
  createItem: (
    companyId: string,
    userId: string,
    collectionKey: CollectionKey,
    data: Omit<LookupItem, "id" | "entityStatus" | "createdAt">,
  ) => Promise<void>;

  updateItem: (
    companyId: string,
    userId: string,
    collectionKey: CollectionKey,
    id: string,
    data: Partial<Omit<LookupItem, "id" | "createdAt">>,
  ) => Promise<void>;

  deleteItem: (
    companyId: string,
    userId: string,
    collectionKey: CollectionKey,
    id: string,
    itemName: string,
  ) => Promise<void>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const collectionPath = (companyId: string, key: CollectionKey) =>
  ["lookup-lists", companyId, key] as [string, string, string];

const stateKey: Record<
  CollectionKey,
  "accountTypes" | "vehicles" | "departments"
> = {
  "account-types": "accountTypes",
  vehicles: "vehicles",
  departments: "departments",
};

const humanLabel: Record<CollectionKey, string> = {
  "account-types": "Account type",
  vehicles: "Vehicle",
  departments: "Department",
};

function mapDoc(d: {
  id: string;
  data: () => Record<string, unknown>;
}): LookupItem {
  const data = d.data();
  return {
    id: d.id,
    name: (data.name as string) ?? "",
    shortForm: data.shortForm as string | undefined,
    entityStatus: (data.entityStatus as boolean) ?? true,
    createdAt: toDate(data.createdAt),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useLookupStore = create<LookupState>((set) => ({
  accountTypes: [],
  vehicles: [],
  departments: [],
  loading: { "account-types": true, vehicles: true, departments: true },
  error: { "account-types": null, vehicles: null, departments: null },

  // ── Subscribe to all three collections in real-time ──────────────────────
  subscribeAll: (companyId, _userId) => {
    const keys: CollectionKey[] = ["account-types", "vehicles", "departments"];

    // Clear previous company data so UI doesn't flash stale lookups
    set({
      accountTypes: [],
      vehicles: [],
      departments: [],
      loading: { "account-types": true, vehicles: true, departments: true },
      error: { "account-types": null, vehicles: null, departments: null },
    });

    const unsubs = keys.map((key) => {
      const q = query(
        collection(db, ...collectionPath(companyId, key)),
        orderBy("createdAt", "desc"),
      );

      return onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map(mapDoc);
          set((state) => ({
            [stateKey[key]]: items,
            loading: { ...state.loading, [key]: false },
            error: { ...state.error, [key]: null },
          }));
        },
        (err) => {
          console.error(`[useLookupStore] Failed to fetch ${key}:`, err);
          set((state) => ({
            loading: { ...state.loading, [key]: false },
            error: {
              ...state.error,
              [key]: `Failed to fetch ${humanLabel[key].toLowerCase()}s`,
            },
          }));
        },
      );
    });

    // Return a single unsubscribe that tears down all listeners
    return () => unsubs.forEach((u) => u());
  },

  // ── Create ───────────────────────────────────────────────────────────────
  createItem: async (companyId, userId, collectionKey, data) => {
    const batch = writeBatch(db);

    const itemRef = doc(
      collection(db, ...collectionPath(companyId, collectionKey)),
    );
    batch.set(itemRef, {
      ...data,
      entityStatus: true,
      createdAt: serverTimestamp(),
    });

    const auditRef = doc(collection(db, "auditLogs"));
    batch.set(auditRef, {
      userId,
      action: "create",
      description: `${humanLabel[collectionKey]} created: ${data.name}`,
      companyId,
      entityStatus: true,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  },

  // ── Update ───────────────────────────────────────────────────────────────
  updateItem: async (companyId, userId, collectionKey, id, data) => {
    const batch = writeBatch(db);

    const itemRef = doc(db, ...collectionPath(companyId, collectionKey), id);
    batch.update(itemRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });

    const auditRef = doc(collection(db, "auditLogs"));
    batch.set(auditRef, {
      userId,
      action: "update",
      description: `${humanLabel[collectionKey]} updated: ${data.name ?? id}`,
      companyId,
      entityStatus: true,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  },

  // ── Delete ───────────────────────────────────────────────────────────────
  deleteItem: async (companyId, userId, collectionKey, id, itemName) => {
    const batch = writeBatch(db);

    const itemRef = doc(db, ...collectionPath(companyId, collectionKey), id);
    batch.delete(itemRef);

    const auditRef = doc(collection(db, "auditLogs"));
    batch.set(auditRef, {
      userId,
      action: "delete",
      description: `${humanLabel[collectionKey]} deleted: ${itemName}`,
      companyId,
      entityStatus: true,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  },
}));
