import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../src/infra/prisma/prisma.service.js";
import { as, balance, brokenBalances, CO, createApp, ids, seed, today } from "./helpers.js";

/** Lookups, inventory, VAT payments and custom reports. */
describe("lookups, inventory, VAT and reports", () => {
    let app: INestApplication;
    let db: PrismaService;
    const L = `/companies/${CO}/lookups`;

    beforeAll(async () => ({ app, db } = await createApp()));
    afterAll(async () => app.close());
    beforeEach(async () => seed(db));
    afterEach(async () => expect(await brokenBalances(db)).toEqual([]));

    describe("lookups", () => {
        it("lists all four lookup lists in one call", async () => {
            const res = await as(app, ids.general).get(L);
            expect(res.status).toBe(200);
            expect(res.body.departments.map((d: { name: string }) => d.name)).toEqual(["Operations"]);
            expect(res.body.vehicles).toHaveLength(1);
        });

        it("protects the system Client and Supplier account types", async () => {
            const api = as(app, ids.admin);
            expect((await api.post(`${L}/account-types`, { name: "client" })).status).toBe(400);
            await db.accountType.create({ data: { id: "at-client", companyId: CO, name: "Client", isSystem: true } });
            expect((await api.patch(`${L}/account-types/at-client`, { name: "X" })).status).toBe(400);
            expect((await api.delete(`${L}/account-types/at-client`)).status).toBe(400);
        });

        it("hides an item that's still in use instead of deleting it, and revives it by name", async () => {
            const api = as(app, ids.general);
            await api.post(`/companies/${CO}/transactions`, {
                date: today(),
                description: "Uses the department",
                department: "Operations",
                creditingAccount: ids.bank,
                debitingAccount: ids.cash,
                amount: 10,
            });
            expect((await api.delete(`${L}/departments/${ids.dept}`)).status).toBe(200);
            const hidden = await db.department.findUniqueOrThrow({ where: { id: ids.dept } });
            expect(hidden.entityStatus).toBe(false);
            expect((await api.post(`${L}/departments`, { name: "Operations", shortForm: "OP" })).status).toBe(201);
            expect((await db.department.findUniqueOrThrow({ where: { id: ids.dept } })).entityStatus).toBe(true);
        });

        it("rejects duplicate names and unknown kinds", async () => {
            const api = as(app, ids.general);
            expect((await api.post(`${L}/departments`, { name: "Operations" })).status).toBe(400);
            expect((await api.post(`${L}/not-a-kind`, { name: "X" })).status).toBe(400);
        });
    });

    describe("inventory", () => {
        it("adds, assigns, returns and deletes a part, with the usual rules", async () => {
            const api = as(app, ids.general);
            const part = (await api.post(`/companies/${CO}/spare-parts`, { partId: "AB-1", description: "Filter" })).body.id;
            const dup = await api.post(`/companies/${CO}/spare-parts`, { partId: "ab-1 ", description: "Again" });
            expect(dup.status).toBe(400);
            expect(dup.body.message).toBe("Part ID ab-1 is already in inventory.");

            expect((await api.post(`/companies/${CO}/spare-parts/${part}/assign`, { vehicleId: ids.vehicle })).status).toBe(201);
            expect((await api.post(`/companies/${CO}/spare-parts/${part}/assign`, { vehicleId: ids.vehicle })).status).toBe(400);
            expect((await api.delete(`/companies/${CO}/spare-parts/${part}`)).status).toBe(400); // still on a vehicle

            const released = await api.post(`/companies/${CO}/vehicles/${ids.vehicle}/release-parts`);
            expect(released.body.count).toBe(1);
            expect((await api.delete(`/companies/${CO}/spare-parts/${part}`)).status).toBe(200);
            // a deleted part frees its ID
            expect((await api.post(`/companies/${CO}/spare-parts`, { partId: "AB-1", description: "New one" })).status).toBe(201);
        });
    });

    describe("VAT", () => {
        const vat = (amount: number) => ({
            quarterKey: "2026-27-Q3",
            quarterLabel: "2026/27 Q3",
            due: 300,
            date: today(),
            amount,
            reference: "R1",
            accountId: ids.bank,
        });

        it("records a payment from the paying account, capped at what's still due", async () => {
            const api = as(app, ids.general);
            const id = (await api.post(`/companies/${CO}/vat-payments`, vat(200))).body.id;
            expect(await balance(db, ids.bank)).toBe(800);
            const over = await api.post(`/companies/${CO}/vat-payments`, vat(150));
            expect(over.status).toBe(400);
            expect(over.body.message).toBe("Only LKR 100.00 is still payable for 2026/27 Q3.");

            expect((await api.post(`/companies/${CO}/vat-payments/${id}/delete`, { quarterLabel: "2026/27 Q3" })).status).toBe(201);
            expect(await balance(db, ids.bank)).toBe(1000);
            expect((await api.post(`/companies/${CO}/vat-payments`, vat(300))).status).toBe(201);
        });
    });

    describe("custom reports", () => {
        it("creates a report with its accounts and saves filters", async () => {
            const api = as(app, ids.general);
            const res = await api.post(`/companies/${CO}/reports`, { name: "Bank report", accountIds: [ids.bank, ids.cash] });
            expect(res.status).toBe(201);
            expect(await db.reportAccount.count({ where: { reportId: res.body.id } })).toBe(2);
            const saved = await api.patch(`/companies/${CO}/reports/${res.body.id}/filters`, { filters: { tagFilter: ["active"] } });
            expect(saved.status).toBe(200);
            expect((await db.report.findUniqueOrThrow({ where: { id: res.body.id } })).filters).toEqual({ tagFilter: ["active"] });
            // another company's account can't be put on a report
            expect((await api.post(`/companies/${CO}/reports`, { name: "X", accountIds: [ids.otherCoAccount] })).status).toBe(400);
        });
    });
});
