import type { Prisma } from "../../generated/prisma/client.js";

/** A Prisma client bound to an open SQL transaction (the `tx` in `prisma.$transaction(async (tx) => …)`). */
export type Tx = Prisma.TransactionClient;

export type AuditEntry = {
    userId: string;
    /** Empty for entries that aren't about one company (e.g. a username change). */
    companyId?: string | null;
    action: string;
    description: string;
    /** ID of the record the entry is about. */
    entityId?: string;
};

/**
 * Writes an audit log entry inside the same SQL transaction as the change it
 * describes, so a change and its audit entry are saved together or not at all.
 */
export function audit(tx: Pick<Tx, "auditLog">, entry: AuditEntry) {
    return tx.auditLog.create({ data: entry });
}
