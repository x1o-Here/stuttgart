"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { usesApi } from "@/lib/data/flags";
import { onLiveCollection } from "@/lib/data/live";
import { toDate } from "@/lib/helpers/to-date";

/** One client invoice line that used the vehicle in its Vehicle No column. */
export type VehicleTrip = {
  id: string;
  invoiceId: string;
  clientId: string;
  clientName: string;
  taxInvoiceNo: string;
  /** The line's own date. */
  date: Date | null;
};

/**
 * Live list of a vehicle's trips (invoice lines), newest first. Only served
 * by the API; in Firestore mode it is empty.
 */
export function useVehicleTrips(vehicleId: string | undefined) {
  const { activeCompany } = useAuth();
  const [trips, setTrips] = useState<VehicleTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompany || !vehicleId || !usesApi("ledger")) {
      setTrips([]);
      setLoading(!!activeCompany && !!vehicleId && usesApi("ledger"));
      return;
    }
    setLoading(true);
    return onLiveCollection(
      "ledger",
      ["companies", activeCompany, "vehicles", vehicleId, "trips"],
      (snapshot) => {
        setTrips(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              invoiceId: String(data.invoiceId ?? ""),
              clientId: String(data.clientId ?? ""),
              clientName: String(data.clientName ?? ""),
              taxInvoiceNo: String(data.taxInvoiceNo ?? ""),
              date: toDate(data.date) ?? null,
            };
          }),
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load vehicle trips:", err);
        setError("Couldn’t load trips. Check your connection and access.");
        setLoading(false);
      },
    );
  }, [activeCompany, vehicleId]);

  return { trips, loading, error };
}
