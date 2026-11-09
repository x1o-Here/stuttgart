import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import {
    type Ctx,
    date,
    docsAt,
    lookupName,
    migrate,
    money,
    moneyOrZero,
    Reject,
    seg,
    str,
} from "../context.js";

/** Accounts, then transactions (merged from their two per-account copies). */
export async function migrateLedger(ctx: Ctx) {
    await migrate(
        ctx,
        "accounts",
        await docsAt(ctx, "companies/*/accounts/*"),
        (doc) => {
            const d = doc.data();
            const companyId = seg(doc)[1];
            if (!ctx.known.companies.has(companyId)) throw new Reject(`company ${companyId} not found`);
            const typeName = str(d.accountType);
            const accountTypeId = lookupName(ctx.byName.accountTypes, companyId, typeName);
            if (!accountTypeId) throw new Reject(`account type "${typeName}" not found`);

            const clientId = str(d.clientId) || null;
            const supplierId = str(d.supplierId) || null;
            if (clientId && !ctx.known.clients.has(clientId)) throw new Reject(`client ${clientId} not found`);
            if (supplierId && !ctx.known.suppliers.has(supplierId)) throw new Reject(`supplier ${supplierId} not found`);

            return {
                id: doc.id,
                companyId,
                name: str(d.name) || "Unnamed account",
                accountTypeId,
                initialBalance: moneyOrZero(d.initialBalance),
                balance: moneyOrZero(d.balance),
                clientId,
                supplierId,
                entityStatus: d.entityStatus !== false,
                createdAt: date(d.createdAt),
                updatedAt: date(d.updatedAt),
            };
        },
        ({ id, ...data }) => ctx.db.account.upsert({ where: { id }, create: { id, ...data }, update: data }),
        (row) => ctx.known.accounts.add(row.id),
    );

    await migrateTransactions(ctx);
}

type Side = { accountId: string; type: string; data: DocumentData; path: string };

/**
 * Firestore kept every transaction twice: a "credit" doc under the credited
 * account and a "debit" doc under the debited one, with the same doc ID.
 * Here they are grouped by ID and written as one row.
 */
async function migrateTransactions(ctx: Ctx) {
    const docs = await docsAt(ctx, "companies/*/accounts/*/transactions/*");
    const groups = new Map<string, { companyId: string; id: string; sides: Side[]; doc: QueryDocumentSnapshot }>();
    for (const doc of docs) {
        const [, companyId, , accountId, , id] = seg(doc);
        const key = `${companyId}/${id}`;
        const group = groups.get(key) ?? { companyId, id, sides: [], doc };
        group.sides.push({ accountId, type: str(doc.data().type), data: doc.data(), path: doc.ref.path });
        groups.set(key, group);
    }

    // The runner works per document; use the first copy as the group's representative.
    const representatives = [...groups.values()].map((g) => g.doc);
    const byDoc = new Map([...groups.values()].map((g) => [g.doc.ref.path, g]));

    await migrate(
        ctx,
        "transactions",
        representatives,
        (doc) => {
            const group = byDoc.get(doc.ref.path);
            if (!group) throw new Reject("internal: group not found");
            const { companyId, id } = group;
            if (!ctx.known.companies.has(companyId)) throw new Reject(`company ${companyId} not found`);

            let debitAccountId: string | null = null;
            let creditAccountId: string | null = null;
            for (const side of group.sides) {
                if (side.type !== "debit" && side.type !== "credit") {
                    throw new Reject(`${side.path}: type is "${side.type}", expected debit or credit`);
                }
                if (!ctx.known.accounts.has(side.accountId)) {
                    ctx.log.warn(`${side.path}: account ${side.accountId} wasn't imported → this side dropped`);
                    continue;
                }
                if (side.type === "debit") {
                    if (debitAccountId) throw new Reject("two debit entries share this ID");
                    debitAccountId = side.accountId;
                } else {
                    if (creditAccountId) throw new Reject("two credit entries share this ID");
                    creditAccountId = side.accountId;
                }
            }
            if (!debitAccountId && !creditAccountId) throw new Reject("no side of this transaction could be imported");

            const amounts = new Set(group.sides.map((s) => money(s.data.amount, "amount")));
            if (amounts.size > 1) throw new Reject(`debit and credit amounts differ (${[...amounts].join(" vs ")})`);
            const [amount] = amounts;
            if (!(Number(amount) > 0)) throw new Reject(`amount ${amount} is not above zero`);

            const first = (field: string) => group.sides.map((s) => s.data[field]).find((v) => str(v) !== "") ?? "";
            const when = group.sides.map((s) => date(s.data.date)).find(Boolean);
            if (!when) throw new Reject("date is missing");

            const departmentName = str(first("department"));
            const departmentId = departmentName ? lookupName(ctx.byName.departments, companyId, departmentName) : undefined;
            if (departmentName && !departmentId) {
                ctx.log.warn(`companies/${companyId}/…/transactions/${id}: department "${departmentName}" not found → left empty`);
            }
            const vehicleName = str(first("vehicle"));
            const vehicleId = vehicleName ? lookupName(ctx.byName.vehicles, companyId, vehicleName) : undefined;
            if (vehicleName && !vehicleId) {
                ctx.log.warn(`companies/${companyId}/…/transactions/${id}: vehicle "${vehicleName}" not found → left empty`);
            }

            const voucher = Number.parseInt(String(group.sides.map((s) => s.data.voucherNo).find((v) => Number(v) > 0) ?? ""), 10);
            const tags = [...new Set(group.sides.flatMap((s) => (Array.isArray(s.data.tags) ? s.data.tags : [])).map(String))];
            const created = group.sides.map((s) => date(s.data.createdAt)).filter((d): d is Date => !!d);
            const updated = group.sides.map((s) => date(s.data.updatedAt)).filter((d): d is Date => !!d);

            return {
                id,
                companyId,
                date: when,
                amount,
                description: str(first("description")),
                chequeNo: str(first("chequeNo")),
                voucherNo: Number.isFinite(voucher) && voucher > 0 ? voucher : null,
                debitAccountId,
                creditAccountId,
                departmentId: departmentId ?? null,
                vehicleId: vehicleId ?? null,
                tags,
                createdAt: created.length ? new Date(Math.min(...created.map(Number))) : undefined,
                updatedAt: updated.length ? new Date(Math.max(...updated.map(Number))) : undefined,
            };
        },
        ({ id, ...data }) => ctx.db.transaction.upsert({ where: { id }, create: { id, ...data }, update: data }),
        (row) => ctx.known.transactions.add(row.id),
    );
}
