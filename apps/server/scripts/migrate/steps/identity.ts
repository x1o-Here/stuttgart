import { Role } from "../../../src/generated/prisma/client.js";
import { type Ctx, date, migrate, oneOf, Reject, str, userRef } from "../context.js";

const ROLES = Object.values(Role);

/** users → companies → user_companies */
export async function migrateIdentity(ctx: Ctx) {
    const users = (await ctx.fs.collection("users").get()).docs;
    await migrate(
        ctx,
        "users",
        users,
        (doc) => {
            const d = doc.data();
            return {
                id: doc.id,
                username: str(d.username) || str(d.email) || doc.id,
                email: str(d.email),
                role: oneOf(d.role, ROLES, Role.general, () =>
                    ctx.log.warn(`${doc.ref.path}: unknown role "${d.role}" → general`),
                ),
                firstSignIn: d.firstSignIn === true,
                entityStatus: d.entityStatus !== false,
                createdAt: date(d.createdAt),
            };
        },
        ({ id, ...data }) => ctx.db.user.upsert({ where: { id }, create: { id, ...data }, update: data }),
        (row) => ctx.known.users.add(row.id),
    );

    const companies = (await ctx.fs.collection("companies").get()).docs;
    await migrate(
        ctx,
        "companies",
        companies,
        (doc) => {
            const d = doc.data();
            return {
                id: doc.id,
                name: str(d.name) || doc.id,
                address: str(d.address),
                telephoneNo: str(d.telephoneNo),
                tin: str(d.tin),
                entityStatus: d.entityStatus !== false,
                createdAt: date(d.createdAt) ?? date(d.updatedAt),
                updatedAt: date(d.updatedAt),
                updatedById: userRef(ctx, d.updatedBy, doc.ref.path, "updatedBy"),
            };
        },
        ({ id, ...data }) => ctx.db.company.upsert({ where: { id }, create: { id, ...data }, update: data }),
        (row) => ctx.known.companies.add(row.id),
    );

    // The `companies` array on each user → user_companies rows (replaced per user).
    await migrate(
        ctx,
        "user_companies",
        users.filter((doc) => ctx.known.users.has(doc.id)),
        (doc) => {
            const list: unknown[] = Array.isArray(doc.data().companies) ? doc.data().companies : [];
            const companyIds = list.filter((id): id is string => {
                if (typeof id === "string" && ctx.known.companies.has(id)) return true;
                ctx.log.warn(`${doc.ref.path}: company "${String(id)}" not found → link skipped`);
                return false;
            });
            if (companyIds.length === 0 && list.length > 0) throw new Reject("none of the user's companies exist");
            return { userId: doc.id, companyIds };
        },
        ({ userId, companyIds }) =>
            ctx.db.$transaction([
                ctx.db.userCompany.deleteMany({ where: { userId } }),
                ctx.db.userCompany.createMany({ data: companyIds.map((companyId) => ({ userId, companyId })) }),
            ]),
    );
}
