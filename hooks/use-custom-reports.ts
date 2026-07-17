"use client";

import { collection, doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import { toDate } from "@/lib/helpers/to-date";

export type ReportFilters = {
  accountFilter: string;
  typeFilter: string;
  departmentFilter: string;
  vehicleFilter: string;
  tagFilter: string[];
};

export type CustomReport = {
  id: string;
  name: string;
  description?: string;
  fromDate?: Date;
  toDate?: Date;
  accountIds?: string[];
  filters?: ReportFilters;
  createdBy?: string;
  createdAt?: Date;
  entityStatus?: boolean;
};

function mapReportDoc(id: string, data: Record<string, any>): CustomReport {
  return {
    id,
    name: data.name || "Untitled report",
    description: data.description || "",
    accountIds: Array.isArray(data.accountIds) ? data.accountIds : [],
    filters: data.filters
      ? {
          accountFilter: data.filters.accountFilter || "all",
          typeFilter: data.filters.typeFilter || "all",
          departmentFilter: data.filters.departmentFilter || "all",
          vehicleFilter: data.filters.vehicleFilter || "all",
          tagFilter: Array.isArray(data.filters.tagFilter)
            ? data.filters.tagFilter
            : ["active"],
        }
      : undefined,
    createdBy: data.createdBy,
    entityStatus: data.entityStatus ?? true,
    fromDate: toDate(data.fromDate),
    toDate: toDate(data.toDate),
    createdAt: toDate(data.createdAt),
  };
}

export function useCustomReports() {
  const { activeCompany } = useAuth();
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompany) {
      setReports([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const reportsRef = collection(db, "companies", activeCompany, "reports");

    const unsubscribe = onSnapshot(
      reportsRef,
      (snapshot) => {
        const next = snapshot.docs
          .map((docSnap) => mapReportDoc(docSnap.id, docSnap.data()))
          .filter((report) => report.entityStatus !== false)
          .sort((a, b) => {
            const aTime = a.createdAt?.getTime() ?? 0;
            const bTime = b.createdAt?.getTime() ?? 0;
            return bTime - aTime;
          });

        setReports(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Failed to fetch custom reports:", err);
        setReports([]);
        setLoading(false);
        setError("Failed to load reports");
      },
    );

    return () => unsubscribe();
  }, [activeCompany]);

  return { reports, loading, error };
}

export function useCustomReport(reportId: string | undefined) {
  const { activeCompany } = useAuth();
  const [report, setReport] = useState<CustomReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompany || !reportId) {
      setReport(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const reportRef = doc(db, "companies", activeCompany, "reports", reportId);

    const unsubscribe = onSnapshot(
      reportRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setReport(null);
          setLoading(false);
          setError("Report not found");
          return;
        }

        const mapped = mapReportDoc(snapshot.id, snapshot.data());
        if (mapped.entityStatus === false) {
          setReport(null);
          setError("Report not found");
        } else {
          setReport(mapped);
          setError(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Failed to fetch custom report:", err);
        setReport(null);
        setLoading(false);
        setError("Failed to load report");
      },
    );

    return () => unsubscribe();
  }, [activeCompany, reportId]);

  return { report, loading, error };
}
