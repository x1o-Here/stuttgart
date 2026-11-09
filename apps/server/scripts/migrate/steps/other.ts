import { SparePartStatus } from "../../../src/generated/prisma/client.js";
import {
    type Ctx,
    cents,
    date,
    docsAt,
    json,
    migrate,
    money,
    oneOf,
    Reject,
    requiredDate,
    seg,
    str,
    userRef,
} from "../context.js";
import { transactionRef } from "./sales.js";

const PART_STATUSES = Object.values(SparePartStatus);

export async function migrateVatPayments(ctx: Ctx) {
    await migrate(
        ctx,
        "vat_payments",
        await docsAt(ctx, "companies/*/vatPayments/*"),
        (doc) => {
            const d = doc.data();
            const companyId = seg(doc)[1];
            if (!ctx.known.companies.has(companyId)) throw new Reject(`company ${companyId} not found`);
            const accountId = str(d.accountId);
            if (!ctx.known.accounts.has(accountId)) throw new Reject(`account ${accountId} not found`);
            const quarterKey = str(d.quarterKey);
            if (!quarterKey) throw new Reject("quarterKey is empty");
            return {
                id: doc.id,
                companyId,
                quarterKey,
                date: requiredDate(d.date, "date"),
                amount: money(d.amount, "amount"),
                reference: str(d.reference),
                accountId,
                transactionId: transactionRef(ctx, d, doc.ref.path),
                entityStatus: d.entityStatus !== false,
                createdAt: date(d.createdAt),
                updatedAt: date(d.updatedAt),
                createdById: userRef(ctx, d.createdBy, doc.ref.path, "createdBy"),
                updatedById: userRef(ctx, d.updatedBy, doc.ref.path, "updatedBy"),
            };
        },
        ({ id, ...data }) => ctx.db.vatPayment.upsert({ where: { id }, create: { id, ...data }, update: data }),
        (row) => {
            if (!row.entityStatus) return;
            const key = `${row.companyId}|${row.quarterKey}`;
            ctx.expected.vatByQuarter.set(key, (ctx.expected.vatByQuarter.get(key) ?? 0) + cents(row.amount));
        },
    );
}

export async function migrateSpareParts(ctx: Ctx) {
    await migrate(
        ctx,
        "spare_parts",
        await docsAt(ctx, "companies/*/spareParts/*"),
        (doc) => {
            const d = doc.data();
            const companyId = seg(doc)[1];
            if (!ctx.known.companies.has(companyId)) throw new Reject(`company ${companyId} not found`);
            const partId = str(d.partId);
            if (!partId) throw new Reject("partId is empty");
            let vehicleId = str(d.vehicleId) || null;
            if (vehicleId && !ctx.known.vehicles.has(vehicleId)) {
                ctx.log.warn(`${doc.ref.path}: vehicle ${vehicleId} not found → left empty`);
                vehicleId = null;
            }
            return {
                id: doc.id,
                companyId,
                partId,
                partIdKey: str(d.partIdKey) || partId.toLowerCase(),
                description: str(d.description),
                status: oneOf(d.status, PART_STATUSES, SparePartStatus.in_stock, () =>
                    ctx.log.warn(`${doc.ref.path}: unknown status "${d.status}" → in_stock`),
                ),
                vehicleId,
                assignedAt: date(d.assignedAt) ?? null,
                entityStatus: d.entityStatus !== false,
                createdAt: date(d.createdAt),
                updatedAt: date(d.updatedAt),
                createdById: userRef(ctx, d.createdBy, doc.ref.path, "createdBy"),
                updatedById: userRef(ctx, d.updatedBy, doc.ref.path, "updatedBy"),
            };
        },
        ({ id, ...data }) => ctx.db.sparePart.upsert({ where: { id }, create: { id, ...data }, update: data }),
    );
}

export async function migrateReports(ctx: Ctx) {
    await migrate(
        ctx,
        "reports",
        await docsAt(ctx, "companies/*/reports/*"),
        (doc) => {
            const d = doc.data();
            const companyId = seg(doc)[1];
            if (!ctx.known.companies.has(companyId)) throw new Reject(`company ${companyId} not found`);
            const ids: unknown[] = Array.isArray(d.accountIds) ? d.accountIds : [];
            const accountIds = ids.filter((id): id is string => {
                if (typeof id === "string" && ctx.known.accounts.has(id)) return true;
                ctx.log.warn(`${doc.ref.path}: account "${String(id)}" not found → removed from report`);
                return false;
            });
            return {
                report: {
                    id: doc.id,
                    companyId,
                    name: str(d.name) || "Untitled report",
                    description: str(d.description),
                    fromDate: date(d.fromDate) ?? null,
                    toDate: date(d.toDate) ?? null,
                    filters: d.filters ? json(d.filters) : undefined,
                    entityStatus: d.entityStatus !== false,
                    createdAt: date(d.createdAt),
                    updatedAt: date(d.updatedAt),
                    createdById: userRef(ctx, d.createdBy, doc.ref.path, "createdBy"),
                },
                accountIds,
            };
        },
        ({ report: { id, ...data }, accountIds }) =>
            ctx.db.$transaction([
                ctx.db.report.upsert({ where: { id }, create: { id, ...data }, update: data }),
                ctx.db.reportAccount.deleteMany({ where: { reportId: id } }),
                ctx.db.reportAccount.createMany({ data: accountIds.map((accountId) => ({ reportId: id, accountId })) }),
            ]),
    );
}

export async function migrateAuditLogs(ctx: Ctx) {
    await migrate(
        ctx,
        "audit_logs",
        (await ctx.fs.collection("auditLogs").get()).docs,
        (doc) => {
            const d = doc.data();
            let companyId = str(d.companyId) || null;
            if (companyId && !ctx.known.companies.has(companyId)) {
                ctx.log.warn(`${doc.ref.path}: company ${companyId} not found → left empty`);
                companyId = null;
            }
            return {
                id: doc.id,
                companyId,
                userId: userRef(ctx, d.userId, doc.ref.path, "userId"),
                action: str(d.action) || "unknown",
                description: str(d.description),
                entityId: str(d.transactionId) || null,
                entityStatus: d.entityStatus !== false,
                createdAt: date(d.createdAt),
            };
        },
        ({ id, ...data }) => ctx.db.auditLog.upsert({ where: { id }, create: { id, ...data }, update: data }),
    );
}
