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
import {
  CLIENT_ACCOUNT_TYPE_NAME,
  isClientAccountTypeName,
  isProtectedAccountType,
} from "@/lib/constants/client-account";
import { db } from "@/lib/firebase/firebase-client";
import { toDate } from "@/lib/helpers/to-date";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LookupItem = {
  id: string;
  name: string;
  shortForm?: string;
  entityStatus: boolean;
  /** System rows (e.g. Client account type) cannot be edited or deleted. */
  isSystem?: boolean;
  createdAt?: Date;
};

export type CollectionKey = "account-types" | "vehicles" | "departments";

type CompanyLookupCache = {
  accountTypes: LookupItem[];
  vehicles: LookupItem[];
  departments: LookupItem[];
};

type LookupState = {
  activeCompanyId: string | null;
  accountTypes: LookupItem[];
  vehicles: LookupItem[];
  departments: LookupItem[];
  loading: Record<CollectionKey, boolean>;
  error: Record<CollectionKey, string | null>;
  /** In-memory per-company snapshots so switching back doesn't flash empty. */
  cacheByCompany: Record<string, CompanyLookupCache>;

  subscribeAll: (companyId: string, userId: string) => () => void;

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
    isSystem: data.isSystem === true,
    createdAt: toDate(data.createdAt),
  };
}

const emptyLoading = {
  "account-types": true,
  vehicles: true,
  departments: true,
} as const;

const emptyError = {
  "account-types": null,
  vehicles: null,
  departments: null,
} as const;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useLookupStore = create<LookupState>((set, get) => ({
  activeCompanyId: null,
  accountTypes: [],
  vehicles: [],
  departments: [],
  loading: { ...emptyLoading },
  error: { ...emptyError },
  cacheByCompany: {},

  subscribeAll: (companyId, _userId) => {
    const keys: CollectionKey[] = ["account-types", "vehicles", "departments"];
    const cached = get().cacheByCompany[companyId];

    if (cached) {
      // Warm hydrate — avoid empty flash; still attach live listeners below.
      set({
        activeCompanyId: companyId,
        accountTypes: cached.accountTypes,
        vehicles: cached.vehicles,
        departments: cached.departments,
        loading: {
          "account-types": false,
          vehicles: false,
          departments: false,
        },
        error: { ...emptyError },
      });
    } else {
      set({
        activeCompanyId: companyId,
        accountTypes: [],
        vehicles: [],
        departments: [],
        loading: { ...emptyLoading },
        error: { ...emptyError },
      });
    }

    const unsubs = keys.map((key) => {
      const q = query(
        collection(db, ...collectionPath(companyId, key)),
        orderBy("createdAt", "desc"),
      );

      return onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map(mapDoc);
          set((state) => {
            const nextSlice = { [stateKey[key]]: items } as Pick<
              LookupState,
              "accountTypes" | "vehicles" | "departments"
            >;
            const prevCache = state.cacheByCompany[companyId] ?? {
              accountTypes: state.accountTypes,
              vehicles: state.vehicles,
              departments: state.departments,
            };
            const nextCacheEntry: CompanyLookupCache = {
              ...prevCache,
              ...nextSlice,
            };
            return {
              ...nextSlice,
              loading: { ...state.loading, [key]: false },
              error: { ...state.error, [key]: null },
              cacheByCompany: {
                ...state.cacheByCompany,
                [companyId]: nextCacheEntry,
              },
            };
          });
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

    return () => unsubs.forEach((u) => u());
  },

  createItem: async (companyId, userId, collectionKey, data) => {
    if (
      collectionKey === "account-types" &&
      isClientAccountTypeName(data.name)
    ) {
      throw new Error(
        `The "${CLIENT_ACCOUNT_TYPE_NAME}" account type is system-managed and cannot be created manually.`,
      );
    }

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

  updateItem: async (companyId, userId, collectionKey, id, data) => {
    if (collectionKey === "account-types") {
      const existing = get().accountTypes.find((item) => item.id === id);
      if (existing && isProtectedAccountType(existing)) {
        throw new Error(
          `The "${CLIENT_ACCOUNT_TYPE_NAME}" account type cannot be edited.`,
        );
      }
      if (data.name && isClientAccountTypeName(data.name)) {
        throw new Error(
          `Cannot rename an account type to "${CLIENT_ACCOUNT_TYPE_NAME}".`,
        );
      }
    }

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

  deleteItem: async (companyId, userId, collectionKey, id, itemName) => {
    if (collectionKey === "account-types") {
      const existing = get().accountTypes.find((item) => item.id === id);
      if (
        (existing && isProtectedAccountType(existing)) ||
        isClientAccountTypeName(itemName)
      ) {
        throw new Error(
          `The "${CLIENT_ACCOUNT_TYPE_NAME}" account type cannot be deleted.`,
        );
      }
    }

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
