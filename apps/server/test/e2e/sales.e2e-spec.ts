import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../src/infra/prisma/prisma.service.js";
import { as, balance, brokenBalances, CO, createApp, ids, seed, today } from "./helpers.js";

/** Clients, client invoices and their payments. */
describe("sales", () => {
    let app: INestApplication;
    let db: PrismaService;
    let clientId: string;
    let clientAccount: string;
    let invoiceId: string;

    const invoiceBody = (over: Record<string, unknown> = {}) => ({
        taxInvoiceNo: "INV-0001",
        date: today(),
        delivery: { date: today(), address: "Port", reference: "DN-1" },
        client: { id: clientId, name: "Client One" },
        template: { columns: [] },
        lineItems: [
            { date: today(), vehicleNo: "WP-1234", rate: 600, amount: 600, customValues: {} },
            { date: today(), vehicleNo: "WP-1234", rate: 400, amount: 400, customValues: { trip: "A" } },
        ],
        totalAmount: 1000,
        vatAmount: 180,
        totalIncludingVat: 1180,
        ...over,
    });
    const pay = (amount: number, over: Record<string, unknown> = {}) => ({
        date: today(),
        description: "Cheque",
        chequeNo: "  77  ",
        amount,
        creditingAccountId: ids.bank,
        debitingAccountId: clientAccount,
        ...over,
    });
    const invoice = () => db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const base = () => `/companies/${CO}/clients/${clientId}`;

    beforeAll(async () => ({ app, db } = await createApp()));
    afterAll(async () => app.close());
    beforeEach(async () => {
        await seed(db);
        const api = as(app, ids.general);
        const created = await api.post(`/companies/${CO}/clients`, {
            name: "Client One",
            address: "Kandy",
            vatNo: "V1",
            contactNo: "077",
        });
        expect(created.status).toBe(201);
        clientId = created.body.id;
        clientAccount = (await db.account.findFirstOrThrow({ where: { clientId } })).id;
        const inv = await api.post(`${base()}/invoices`, invoiceBody());
        expect(inv.status).toBe(201);
        invoiceId = inv.body.id;
    });
    afterEach(async () => expect(await brokenBalances(db)).toEqual([]));

    it("creating a client also creates its account under the system Client type", async () => {
        const account = await db.account.findFirstOrThrow({ where: { clientId }, include: { accountType: true } });
        expect(account.accountType.name).toBe("Client");
        expect(account.accountType.isSystem).toBe(true);
        const entries = await db.auditLog.findMany({ where: { description: { startsWith: "Client" } } });
        expect(entries.map((e) => e.description).sort()).toEqual([
            "Client account created: Client One",
            "Client created: Client One",
        ]);
    });

    it("stores the invoice with its lines and the full total outstanding", async () => {
        const row = await invoice();
        expect(Number(row.outstandingAmount)).toBe(1180);
        expect(row.status).toBe("issued");
        expect(await db.invoiceLineItem.count({ where: { invoiceId } })).toBe(2);
    });

    it("rejects totals that don't add up", async () => {
        const res = await as(app, ids.general).post(`${base()}/invoices`, invoiceBody({ totalAmount: 900 }));
        expect(res.status).toBe(400);
        expect(res.body.message).toContain("don't add up");
    });

    it("a payment posts to the ledger and reduces what's outstanding", async () => {
        const res = await as(app, ids.general).post(`${base()}/invoices/${invoiceId}/payments`, pay(500));
        expect(res.status).toBe(201);
        expect(Number((await invoice()).outstandingAmount)).toBe(680);
        expect((await invoice()).status).toBe("partial");
        expect(await balance(db, ids.bank)).toBe(1500);
        expect(await balance(db, clientAccount)).toBe(-500);
        const payment = await db.invoicePayment.findUniqueOrThrow({
            where: { id: res.body.id },
            include: { transaction: true },
        });
        expect(payment.chequeNo).toBe("77");
        expect(payment.transaction?.tags).toEqual(["invoice-payment", "INV-0001"]);
    });

    it("editing a payment replaces its ledger entry instead of adding one", async () => {
        const api = as(app, ids.general);
        const id = (await api.post(`${base()}/invoices/${invoiceId}/payments`, pay(500))).body.id;
        const res = await api.put(`${base()}/invoices/${invoiceId}/payments/${id}`, pay(300, { creditingAccountId: ids.cash }));
        expect(res.status).toBe(200);
        expect(await db.transaction.count()).toBe(1);
        expect(await balance(db, ids.bank)).toBe(1000); // moved off the bank…
        expect(await balance(db, ids.cash)).toBe(300); // …onto cash
        expect(Number((await invoice()).outstandingAmount)).toBe(880);
    });

    it("paying in full marks the invoice paid; deleting a payment reopens it", async () => {
        const api = as(app, ids.general);
        await api.post(`${base()}/invoices/${invoiceId}/payments`, pay(1000));
        const last = (await api.post(`${base()}/invoices/${invoiceId}/payments`, pay(180))).body.id;
        expect((await invoice()).status).toBe("paid");
        expect(Number((await invoice()).outstandingAmount)).toBe(0);

        const res = await api.delete(`${base()}/invoices/${invoiceId}/payments/${last}`);
        expect(res.status).toBe(200);
        expect((await invoice()).status).toBe("partial");
        expect(Number((await invoice()).outstandingAmount)).toBe(180);
        const deleted = await db.invoicePayment.findUniqueOrThrow({ where: { id: last } });
        expect(deleted.entityStatus).toBe(false);
        expect(deleted.transactionId).toBeNull();
        expect(await balance(db, ids.bank)).toBe(2000);
    });

    it("blocks overpaying and completing an invoice that isn't fully paid", async () => {
        const api = as(app, ids.general);
        const over = await api.post(`${base()}/invoices/${invoiceId}/payments`, pay(2000));
        expect(over.status).toBe(400);
        expect(over.body.message).toContain("cannot exceed 1180.00");
        expect((await api.post(`${base()}/invoices/${invoiceId}/complete`)).status).toBe(400);
    });

    it("won't lower an invoice total below what's already paid", async () => {
        const api = as(app, ids.general);
        await api.post(`${base()}/invoices/${invoiceId}/payments`, pay(700));
        const lines = [{ date: today(), vehicleNo: "", rate: 500, amount: 500, customValues: {} }];
        const res = await api.put(
            `${base()}/invoices/${invoiceId}`,
            invoiceBody({ lineItems: lines, totalAmount: 500, vatAmount: 90, totalIncludingVat: 590 }),
        );
        expect(res.status).toBe(400);
    });

    it("deleting an invoice cancels it and hides it", async () => {
        const res = await as(app, ids.general).delete(`${base()}/invoices/${invoiceId}`);
        expect(res.status).toBe(200);
        expect((await invoice()).entityStatus).toBe(false);
        expect((await invoice()).status).toBe("cancelled");
    });

    it("saves one template per client", async () => {
        const api = as(app, ids.general);
        const body = { columns: [{ id: "c1", key: "trip", label: "Trip" }], signing: {}, supplier: { name: "Main Co" } };
        expect((await api.put(`${base()}/template`, body)).status).toBe(200);
        expect((await api.put(`${base()}/template`, body)).status).toBe(200);
        expect(await db.invoiceTemplate.count({ where: { clientId } })).toBe(1);
        const actions = await db.auditLog.findMany({ where: { description: { startsWith: "Invoice template" } } });
        expect(actions.map((a) => a.action)).toEqual(["create", "update"]);
    });
});
