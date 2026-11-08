/**
 * Which feature slices read and write through apps/server instead of Firestore.
 *
 *   NEXT_PUBLIC_API_FEATURES=lookups,identity   → those two slices use the API
 *   NEXT_PUBLIC_API_FEATURES=all                → everything uses the API
 *   (unset or empty)                            → everything stays on Firestore
 *
 * Leave it unset in production until the cutover (Phase 7).
 */
export type Feature =
  | "lookups"
  | "identity"
  | "ledger"
  | "inventory"
  | "vat-reports";

const enabled = new Set(
  (process.env.NEXT_PUBLIC_API_FEATURES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

/** True when this slice reads and writes through apps/server instead of Firestore. */
export const usesApi = (feature: Feature) =>
  enabled.has("all") || enabled.has(feature);

export const ALL_FEATURES: Feature[] = [
  "lookups",
  "identity",
  "ledger",
  "inventory",
  "vat-reports",
];

/** Which slices run where (shown by the dev-only data source banner). */
export function dataSources() {
  const api = ALL_FEATURES.filter((feature) => usesApi(feature));
  const firestore = ALL_FEATURES.filter((feature) => !usesApi(feature));
  // Typos in the flag (e.g. "ledgr") would otherwise silently do nothing.
  const unknown = [...enabled].filter(
    (name) => name !== "all" && !(ALL_FEATURES as string[]).includes(name),
  );
  return { api, firestore, unknown };
}
