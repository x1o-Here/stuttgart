import {
  collection,
  doc,
  serverTimestamp,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase-client";

export type AuditLogPayload = {
  userId?: string | null;
  companyId: string;
  action: string;
  description: string;
  entityStatus?: boolean;
  transactionId?: string;
  createdAt?: unknown;
  [key: string]: unknown;
};

/** Appends a standard auditLogs document to an existing write batch. */
export function appendAuditLog(batch: WriteBatch, payload: AuditLogPayload) {
  const {
    userId,
    companyId,
    action,
    description,
    entityStatus = true,
    transactionId,
    createdAt = serverTimestamp(),
    ...rest
  } = payload;

  const auditLogRef = doc(collection(db, "auditLogs"));
  batch.set(auditLogRef, {
    userId: userId ?? null,
    companyId,
    action,
    description,
    entityStatus,
    ...(transactionId ? { transactionId } : {}),
    createdAt,
    ...rest,
  });

  return auditLogRef;
}
