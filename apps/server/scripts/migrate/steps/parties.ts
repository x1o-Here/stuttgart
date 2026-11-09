import { PartyStatus } from "../../../src/generated/prisma/client.js";
import { type Ctx, date, docsAt, lookupName, migrate, oneOf, Reject, seg, str } from "../context.js";

const STATUSES = Object.values(PartyStatus);

/** Clients and suppliers (before accounts, which point at them). */
export async function migrateParties(ctx: Ctx) {
    await migrate(
        ctx,
        "clients",
        await docsAt(ctx, "companies/*/clients/*"),
        (doc) => {
            const d = doc.data();
            const companyId = seg(doc)[1];
            if (!ctx.known.companies.has(companyId)) throw new Reject(`company ${companyId} not found`);
            return {
                id: doc.id,
                companyId,
                name: str(d.name) || "Unnamed client",
                address: str(d.address),
                contactNo: str(d.contactNo),
                vatNo: str(d.vatNo),
                status: oneOf(d.status, STATUSES, PartyStatus.active, () =>
                    ctx.log.warn(`${doc.ref.path}: unknown status "${d.status}" → active`),
                ),
                entityStatus: d.entityStatus !== false,
                createdAt: date(d.createdAt),
                updatedAt: date(d.updatedAt),
            };
        },
        ({ id, ...data }) => ctx.db.client.upsert({ where: { id }, create: { id, ...data }, update: data }),
        (row) => ctx.known.clients.add(row.id),
    );

    await migrate(
        ctx,
        "suppliers",
        await docsAt(ctx, "companies/*/suppliers/*"),
        (doc) => {
            const d = doc.data();
            const companyId = seg(doc)[1];
            if (!ctx.known.companies.has(companyId)) throw new Reject(`company ${companyId} not found`);
            const typeName = str(d.supplierType);
            const supplierTypeId = typeName ? lookupName(ctx.byName.supplierTypes, companyId, typeName) : undefined;
            if (typeName && !supplierTypeId) {
                ctx.log.warn(`${doc.ref.path}: supplier type "${typeName}" not found → left empty`);
            }
            return {
                id: doc.id,
                companyId,
                name: str(d.name) || "Unnamed supplier",
                tin: str(d.tin),
                address: str(d.address),
                contactNo: str(d.contactNo),
                supplierTypeId: supplierTypeId ?? null,
                status: oneOf(d.status, STATUSES, PartyStatus.active, () =>
                    ctx.log.warn(`${doc.ref.path}: unknown status "${d.status}" → active`),
                ),
                entityStatus: d.entityStatus !== false,
                createdAt: date(d.createdAt),
                updatedAt: date(d.updatedAt),
            };
        },
        ({ id, ...data }) => ctx.db.supplier.upsert({ where: { id }, create: { id, ...data }, update: data }),
        (row) => ctx.known.suppliers.add(row.id),
    );
}
