/**
 * Drop-in replacement for Firestore's onSnapshot during the switch to apps/server.
 *
 *  - Firestore mode: exactly onSnapshot.
 *  - API mode: reads the same path from GET /companies/:c/docs/<path>, which
 *    returns records with the old document fields, and re-reads on window
 *    focus, every 30s, and whenever this tab changes data (dataChanged()).
 *
 * Screens keep their existing mapping code because callbacks receive objects
 * with the same `docs` / `id` / `data()` / `exists()` shape as Firestore.
 *
 * Transitional: after the cutover, screens move to typed endpoints and this
 * file is deleted together with Firestore.
 */
import {
  collection,
  type DocumentData,
  type DocumentReference,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { api } from "@/lib/api-client";
import { db } from "@/lib/firebase/firebase-client";
import { type Feature, usesApi } from "./flags";

export type LiveDoc = {
  id: string;
  exists: () => boolean;
  data: () => DocumentData;
};
/** Firestore-mode ordering; the server already returns records in this order. */
export type LiveOrder = { orderBy: string; direction?: "asc" | "desc" };

export type LiveQuerySnapshot = {
  docs: LiveDoc[];
  empty: boolean;
  size: number;
};
/**
 * Like Firestore's DocumentSnapshot: after `snapshot.exists()` is true,
 * TypeScript knows `data()` is defined.
 */
type LiveExistingDoc = {
  id: string;
  exists(): this is LiveExistingDoc;
  data(): DocumentData;
};
type LiveMissingDoc = {
  id: string;
  exists(): this is LiveExistingDoc;
  data(): undefined;
};
export type LiveDocSnapshot = LiveExistingDoc | LiveMissingDoc;

type RawDoc = { id: string; data: DocumentData };

const CHANGED = "stuttgart:data-changed";

/** Call after any write through the API, so every open screen re-reads. */
export function dataChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED));
}

/** Subscribe to "something changed" (used by the TanStack Query provider). */
export function onDataChanged(listener: () => void): () => void {
  window.addEventListener(CHANGED, listener);
  return () => window.removeEventListener(CHANGED, listener);
}

/** Runs `load` now, on focus, every 30s and after dataChanged(); returns a stop function. */
export function poll(
  load: () => Promise<void>,
  onError?: (error: Error) => void,
): () => void {
  let stopped = false;
  let running = false;
  let again = false;
  const run = async () => {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      await load();
    } catch (error) {
      if (!stopped) onError?.(error as Error);
    } finally {
      running = false;
      if (again && !stopped) {
        again = false;
        void run();
      }
    }
  };
  const trigger = () => void run();
  void run();
  window.addEventListener("focus", trigger);
  window.addEventListener(CHANGED, trigger);
  const timer = window.setInterval(trigger, 30_000);
  return () => {
    stopped = true;
    window.removeEventListener("focus", trigger);
    window.removeEventListener(CHANGED, trigger);
    window.clearInterval(timer);
  };
}

const liveDoc = (raw: RawDoc): LiveDoc => ({
  id: raw.id,
  exists: () => true,
  data: () => raw.data,
});

/** ["companies", c, ...rest] → "/companies/c/docs/rest" */
function docsUrl(segments: string[]) {
  const [root, companyId, ...rest] = segments;
  if (root !== "companies" || !companyId) {
    throw new Error(`live: unsupported path ${segments.join("/")}`);
  }
  return `/companies/${companyId}/docs${rest.length ? `/${rest.join("/")}` : ""}`;
}

/**
 * Live collection. `order` sorts in Firestore mode; the server already
 * returns records in the same order.
 */
export function onLiveCollection(
  feature: Feature,
  segments: string[],
  next: (snapshot: LiveQuerySnapshot) => void,
  onError?: (error: Error) => void,
  order?: LiveOrder,
): () => void {
  if (!usesApi(feature)) {
    const ref = collection(db, segments.join("/"));
    return onSnapshot(
      order
        ? query(ref, orderBy(order.orderBy, order.direction ?? "asc"))
        : ref,
      (snapshot) => next(snapshot),
      onError,
    );
  }
  return poll(async () => {
    const { data } = await api.get<{ docs: RawDoc[] }>(docsUrl(segments));
    const docs = data.docs.map(liveDoc);
    next({ docs, empty: docs.length === 0, size: docs.length });
  }, onError);
}

/** Live single document (exists() is false when it isn't there). */
export function onLiveDoc(
  feature: Feature,
  segments: string[],
  next: (snapshot: LiveDocSnapshot) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!usesApi(feature)) {
    const ref: DocumentReference = doc(db, segments.join("/"));
    return onSnapshot(
      ref,
      (snapshot) => next(snapshot as LiveDocSnapshot),
      onError,
    );
  }
  const id = segments[segments.length - 1];
  return poll(async () => {
    const { data } = await api.get<{ doc: RawDoc | null }>(docsUrl(segments));
    const raw = data.doc;
    const snapshot: LiveDocSnapshot = raw
      ? {
          id: raw.id,
          exists: (() => true) as LiveExistingDoc["exists"],
          data: () => raw.data,
        }
      : {
          id,
          exists: (() => false) as LiveMissingDoc["exists"],
          data: () => undefined,
        };
    next(snapshot);
  }, onError);
}

/** One-shot read of a collection (replaces getDocs in API mode). */
export async function readCollection(
  feature: Feature,
  segments: string[],
): Promise<LiveDoc[]> {
  if (!usesApi(feature)) {
    const { getDocs } = await import("firebase/firestore");
    const snap = await getDocs(collection(db, segments.join("/")));
    return snap.docs;
  }
  const { data } = await api.get<{ docs: RawDoc[] }>(docsUrl(segments));
  return data.docs.map(liveDoc);
}
