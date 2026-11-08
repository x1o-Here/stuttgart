import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../src/infra/prisma/prisma.service.js";
import { as, balance, brokenBalances, CO, createApp, ids, seed, today } from "./helpers.js";

/** Accounts and transactions: posting, correcting (reversal) and deleting. */
describe("ledger", () => {
    let app: INestApplication;
    let db: PrismaService;
    const tx = (over: Record<string, unknown> = {}) => ({
        date: today(),
        description: "Fuel",
        department: "Operations",
        vehicle: "WP-1234",
        voucherNo: 12,
        creditingAccount: ids.bank,
        debitingAccount: ids.cash,
        amount: 100,
        ...over,
    });

    beforeAll(async () => ({ app, db } = await createApp()));
    afterAll(async () => app.close());
    beforeEach(async () => seed(db));
    afterEach(async () => expect(await brokenBalances(db)).toEqual([]));

    it("creates an account with its opening balance and an audit entry", async () => {
        const res = await as(app, ids.admin).post(`/companies/${CO}/accounts`, {
            name: "Petty cash",
            accountType: "bank",
            balance: 250,
        });
        expect(res.status).toBe(201);
        const account = await db.account.findUniqueOrThrow({ where: { id: res.body.id } });
        expect(Number(account.balance)).toBe(250);
        expect(Number(account.initialBalance)).toBe(250);
        expect(await db.auditLog.count({ where: { entityId: res.body.id, action: "create" } })).toBe(1);
    });

    it("rejects an unknown account type or a negative opening balance", async () => {
        const api = as(app, ids.admin);
        expect((await api.post(`/companies/${CO}/accounts`, { name: "X", accountType: "Nope", balance: 0 })).status).toBe(400);
        const negative = await api.post(`/companies/${CO}/accounts`, { name: "X", accountType: "Bank", balance: -1 });
        expect(negative.status).toBe(400);
        expect(negative.body.message.join(" ")).toContain("Balance cannot be negative");
    });

    it("posts a transaction: credit account up, debit account down", async () => {
        const res = await as(app, ids.general).post(`/companies/${CO}/transactions`, tx());
        expect(res.status).toBe(201);
        expect(await balance(db, ids.bank)).toBe(1100);
        expect(await balance(db, ids.cash)).toBe(-100);
        const row = await db.transaction.findUniqueOrThrow({ where: { id: res.body.id } });
        expect(row.departmentId).toBe(ids.dept);
        expect(row.vehicleId).toBe(ids.vehicle);
        expect(row.voucherNo).toBe(12);
        expect(await db.auditLog.count({ where: { entityId: res.body.id } })).toBe(1);
    });

    it("corrects a transaction with a reversal, keeping the original", async () => {
        const api = as(app, ids.general);
        const original = (await api.post(`/companies/${CO}/transactions`, tx())).body.id;
        const res = await api.post(`/companies/${CO}/transactions/${original}/correct`, tx({ amount: 150 }));
        expect(res.status).toBe(201);

        expect(await balance(db, ids.bank)).toBe(1150);
        expect(await balance(db, ids.cash)).toBe(-150);
        const rows = await db.transaction.findMany({ orderBy: { createdAt: "asc" } });
        expect(rows).toHaveLength(3);
        expect(rows.find((r) => r.id === original)?.tags).toContain("corrected");
        const reversal = rows.find((r) => r.tags.includes("reversal"));
        expect(reversal?.debitAccountId).toBe(ids.bank); // mirror image of the original
        expect(reversal?.creditAccountId).toBe(ids.cash);
        expect(reversal?.description).toBe("Reversal: Fuel");
    });

    it("won't correct or delete an entry twice", async () => {
        const api = as(app, ids.general);
        const original = (await api.post(`/companies/${CO}/transactions`, tx())).body.id;
        await api.post(`/companies/${CO}/transactions/${original}/correct`, tx({ amount: 150 }));
        const again = await api.post(`/companies/${CO}/transactions/${original}/correct`, tx());
        expect(again.status).toBe(400);
        expect((await api.post(`/companies/${CO}/transactions/${original}/delete`)).status).toBe(400);
    });

    it("deletes a transaction by reversing it", async () => {
        const api = as(app, ids.general);
        const id = (await api.post(`/companies/${CO}/transactions`, tx())).body.id;
        const res = await api.post(`/companies/${CO}/transactions/${id}/delete`);
        expect(res.status).toBe(201);
        expect(await balance(db, ids.bank)).toBe(1000);
        expect(await balance(db, ids.cash)).toBe(0);
        expect((await db.transaction.findUniqueOrThrow({ where: { id } })).tags).toContain("deleted");
        expect(await db.auditLog.count({ where: { action: "delete", entityStatus: false } })).toBe(1);
    });

    it("rejects bad transactions without touching balances", async () => {
        const api = as(app, ids.general);
        const cases = [
            tx({ debitingAccount: ids.bank }), // same account both sides
            tx({ department: "No such dept" }),
            tx({ vehicle: "No such vehicle" }),
            tx({ amount: 0 }),
            tx({ debitingAccount: ids.otherCoAccount }), // another company's account
            tx({ description: "" }),
        ];
        for (const body of cases) {
            expect((await api.post(`/companies/${CO}/transactions`, body)).status).toBe(400);
        }
        expect(await balance(db, ids.bank)).toBe(1000);
        expect(await db.transaction.count()).toBe(0);
    });

    it("rolls the whole write back when one part fails", async () => {
        // The debit account is valid, the department is not: nothing may be written.
        await as(app, ids.general).post(`/companies/${CO}/transactions`, tx({ department: "Missing" }));
        expect(await db.transaction.count()).toBe(0);
        expect(await db.auditLog.count()).toBe(0);
    });
});
