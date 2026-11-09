/**
 * Custom reports on Firestore — moved unchanged from the report screens.
 * (VAT payments live in lib/vat/vat-payments.ts.) Deleted at the cutover.
 */
import type { User } from "firebase/auth";
import {
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import type { ReportFilters } from "@/hooks/use-custom-reports";
import { appendAuditLog } from "@/lib/firebase/audit-log";
import { db } from "@/lib/firebase/firebase-client";

export type ReportFormData = {
  name: string;
  description?: string;
  fromDate?: Date;
  toDate?: Date;
  accountIds: string[];
};

export async function createReport({
  activeCompany,
  data,
  user,
}: {
  activeCompany: string;
  data: ReportFormData;
  user: User;
}) {
  const batch = writeBatch(db);

  const reportRef = doc(collection(db, "companies", activeCompany, "reports"));
  batch.set(reportRef, {
    name: data.name.trim(),
    description: data.description?.trim() || "",
    fromDate: data.fromDate,
    toDate: data.toDate,
    accountIds: data.accountIds,
    createdBy: user.uid,
    entityStatus: true,
    createdAt: serverTimestamp(),
  });
  appendAuditLog(batch, {
    userId: user.uid,
    action: "create",
    description: `Custom report created: ${data.name.trim()}`,
    companyId: activeCompany,
    entityStatus: true,
  });

  await batch.commit();
}

export async function saveReportFilters({
  activeCompany,
  reportId,
  nextFilters,
}: {
  activeCompany: string;
  reportId: string;
  nextFilters: ReportFilters;
}) {
  await updateDoc(doc(db, "companies", activeCompany, "reports", reportId), {
    filters: nextFilters,
    updatedAt: serverTimestamp(),
  });
}
