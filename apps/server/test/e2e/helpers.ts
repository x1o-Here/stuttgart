/**
 * Test harness: the real AppModule (guards, roles, company checks, Zod
 * validation, SQL transactions) against the e2e database. Only Firebase's
 * token check is replaced: in tests the bearer token *is* the user's uid.
 */
import { type INestApplication, StandardSchemaValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { FirebaseService } from "../../src/infra/firebase/firebase.service.js";
import { PrismaService } from "../../src/infra/prisma/prisma.service.js";

export const CO = "co-main";
export const OTHER_CO = "co-other";

/** Seeded IDs every test can rely on. */
export const ids = {
    admin: "u-admin",
    manager: "u-manager",
    general: "u-general",
    removed: "u-removed",
    outsider: "u-outsider", // belongs only to OTHER_CO
    bankType: "at-bank",
    dept: "dept-ops",
    vehicle: "veh-1",
    bank: "acc-bank", // opening balance 1000
    cash: "acc-cash", // opening balance 0
    otherCoAccount: "acc-other",
};

export async function createApp() {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(FirebaseService)
        .useValue({
            auth: {
                verifyIdToken: async (token: string) => {
                    if (token === "bad-token") throw new Error("invalid");
                    return { uid: token };
                },
            },
        })
        .compile();
    const app = moduleRef.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe()); // same as main.ts
    await app.init();
    return { app, db: app.get(PrismaService) };
}

/** Empties every table and inserts the baseline data. */
export async function seed(db: PrismaService) {
    const tables = await db.$queryRawUnsafe<{ tablename: string }[]>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);

    await db.company.createMany({
        data: [
            { id: CO, name: "Main Co" },
            { id: OTHER_CO, name: "Other Co" },
        ],
    });
    await db.user.createMany({
        data: [
            { id: ids.admin, username: "Admin", email: "admin@test.lk", role: "admin" },
            { id: ids.manager, username: "Manager", email: "manager@test.lk", role: "manager" },
            { id: ids.general, username: "General", email: "general@test.lk", role: "general" },
            { id: ids.removed, username: "Gone", email: "", role: "general", entityStatus: false },
            { id: ids.outsider, username: "Outsider", email: "out@test.lk", role: "admin" },
        ],
    });
    await db.userCompany.createMany({
        data: [
            { userId: ids.admin, companyId: CO },
            { userId: ids.manager, companyId: CO },
            { userId: ids.general, companyId: CO },
            { userId: ids.removed, companyId: CO },
            { userId: ids.outsider, companyId: OTHER_CO },
        ],
    });
    await db.accountType.createMany({
        data: [
            { id: ids.bankType, companyId: CO, name: "Bank", shortForm: "BK" },
            { id: "at-other", companyId: OTHER_CO, name: "Bank", shortForm: "BK" },
        ],
    });
    await db.department.create({ data: { id: ids.dept, companyId: CO, name: "Operations", shortForm: "OPS" } });
    await db.vehicle.create({ data: { id: ids.vehicle, companyId: CO, name: "WP-1234" } });
    await db.account.createMany({
        data: [
            { id: ids.bank, companyId: CO, name: "Bank", accountTypeId: ids.bankType, initialBalance: 1000, balance: 1000 },
            { id: ids.cash, companyId: CO, name: "Cash", accountTypeId: ids.bankType },
            { id: ids.otherCoAccount, companyId: OTHER_CO, name: "Their bank", accountTypeId: "at-other" },
        ],
    });
}

/** A request builder that signs requests as `uid` (or sends no token when null). */
export function as(app: INestApplication, uid: string | null) {
    const server = app.getHttpServer();
    const auth = (r: request.Test) => (uid ? r.set("Authorization", `Bearer ${uid}`) : r);
    return {
        get: (path: string) => auth(request(server).get(path)),
        post: (path: string, body?: object) => auth(request(server).post(path)).send(body ?? {}),
        put: (path: string, body?: object) => auth(request(server).put(path)).send(body ?? {}),
        patch: (path: string, body?: object) => auth(request(server).patch(path)).send(body ?? {}),
        delete: (path: string) => auth(request(server).delete(path)),
    };
}

export async function balance(db: PrismaService, accountId: string) {
    const account = await db.account.findUniqueOrThrow({ where: { id: accountId } });
    return Number(account.balance);
}

/**
 * The ledger's core rule: every account's balance equals its opening balance
 * plus credits minus debits. Returns the accounts that break it (should be none).
 */
export async function brokenBalances(db: PrismaService) {
    return db.$queryRawUnsafe<{ name: string; balance: string; expected: string }[]>(`
        SELECT a.name, a.balance::text, (a.initial_balance + COALESCE(c.s, 0) - COALESCE(d.s, 0))::text AS expected
        FROM accounts a
        LEFT JOIN (SELECT credit_account_id AS id, SUM(amount) AS s FROM transactions GROUP BY 1) c ON c.id = a.id
        LEFT JOIN (SELECT debit_account_id  AS id, SUM(amount) AS s FROM transactions GROUP BY 1) d ON d.id = a.id
        WHERE a.balance <> a.initial_balance + COALESCE(c.s, 0) - COALESCE(d.s, 0)`);
}

export const today = () => new Date().toISOString();
