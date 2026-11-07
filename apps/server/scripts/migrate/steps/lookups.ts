import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import {
    type Ctx,
    date,
    docsAt,
    migrate,
    type NameIndex,
    Reject,
    rememberName,
    seg,
    str,
} from "../context.js";

function baseRow(ctx: Ctx, doc: QueryDocumentSnapshot) {
    const d = doc.data();
    const companyId = seg(doc)[1];
    if (!ctx.known.companies.has(companyId)) throw new Reject(`company ${companyId} not found`);
    const name = str(d.name);
    if (!name) throw new Reject("name is empty");
    return {
        id: doc.id,
        companyId,
        name,
        shortForm: str(d.shortForm),
        entityStatus: d.entityStatus !== false,
        createdAt: date(d.createdAt),
        updatedAt: date(d.updatedAt),
    };
}

const remember = (ctx: Ctx, index: NameIndex, known: Set<string>) => (row: { id: string; companyId: string; name: string }) => {
    known.add(row.id);
    rememberName(index, row.companyId, row.name, row.id);
};

/** Settings lookup lists + fleet vehicles. */
export async function migrateLookups(ctx: Ctx) {
    await migrate(
        ctx,
        "account_types",
        await docsAt(ctx, "lookup-lists/*/account-types/*"),
        (doc) => ({ ...baseRow(ctx, doc), isSystem: doc.data().isSystem === true }),
        ({ id, ...data }) => ctx.db.accountType.upsert({ where: { id }, create: { id, ...data }, update: data }),
        remember(ctx, ctx.byName.accountTypes, ctx.known.accountTypes),
    );

    await migrate(
        ctx,
        "departments",
        await docsAt(ctx, "lookup-lists/*/departments/*"),
        (doc) => baseRow(ctx, doc),
        ({ id, ...data }) => ctx.db.department.upsert({ where: { id }, create: { id, ...data }, update: data }),
        remember(ctx, ctx.byName.departments, ctx.known.departments),
    );

    await migrate(
        ctx,
        "supplier_types",
        await docsAt(ctx, "lookup-lists/*/supplier-types/*"),
        (doc) => baseRow(ctx, doc),
        ({ id, ...data }) => ctx.db.supplierType.upsert({ where: { id }, create: { id, ...data }, update: data }),
        remember(ctx, ctx.byName.supplierTypes, ctx.known.supplierTypes),
    );

    // Only companies/{c}/vehicles. The old lookup-lists/{c}/vehicles copies are
    // left behind on purpose (they were already copied into Fleet earlier).
    await migrate(
        ctx,
        "vehicles",
        await docsAt(ctx, "companies/*/vehicles/*"),
        (doc) => ({ ...baseRow(ctx, doc), description: str(doc.data().description) }),
        ({ id, ...data }) => ctx.db.vehicle.upsert({ where: { id }, create: { id, ...data }, update: data }),
        remember(ctx, ctx.byName.vehicles, ctx.known.vehicles),
    );
}
