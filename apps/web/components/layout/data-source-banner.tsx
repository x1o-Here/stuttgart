"use client";

import { Database, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { dataSources } from "@/lib/data/flags";
import { firebaseEmulatorHost } from "@/lib/firebase/firebase-client";

const DISMISS_KEY = "stuttgart:data-source-banner";

/**
 * Development only: shows which slices use the API (local Postgres) and which
 * use Firestore — and warns loudly when Firestore mode would write to a real
 * Firebase project instead of the emulator. Never rendered in production builds.
 */
export function DataSourceBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (process.env.NODE_ENV !== "development" || hidden) return null;

  const { api, firestore, unknown } = dataSources();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "unknown";
  const writesRealFirestore = firestore.length > 0 && !firebaseEmulatorHost;

  function dismiss() {
    setHidden(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // private mode: hide for this page view only
    }
  }

  return (
    <output
      className={`fixed right-3 bottom-3 z-50 max-w-sm rounded-md border px-3 py-2 font-mono text-xs shadow-lg ${
        writesRealFirestore
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      <div className="flex items-start gap-2">
        {writesRealFirestore ? (
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
        ) : (
          <Database className="mt-0.5 size-3.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p>
            <span className="font-semibold">API (local Postgres):</span>{" "}
            {api.length ? api.join(", ") : "none"}
          </p>
          <p>
            <span className="font-semibold">Firestore:</span>{" "}
            {firestore.length ? firestore.join(", ") : "none"}
            {firestore.length > 0 &&
              (firebaseEmulatorHost
                ? ` (emulator at ${firebaseEmulatorHost})`
                : ` → project ${projectId}`)}
          </p>
          {writesRealFirestore && (
            <p className="font-semibold">
              Saving in these slices changes real Firestore data.
            </p>
          )}
          {unknown.length > 0 && (
            <p className="font-semibold">
              Unknown NEXT_PUBLIC_API_FEATURES value: {unknown.join(", ")}
            </p>
          )}
          {api.length > 0 && firestore.length > 0 && (
            <p>Mixed mode: the two halves don’t see each other’s changes.</p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide data source banner"
          className="shrink-0 opacity-70 hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </output>
  );
}
