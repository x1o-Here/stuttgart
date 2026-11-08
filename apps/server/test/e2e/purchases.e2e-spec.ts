import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../src/infra/prisma/prisma.service.js";
import { as, balance, brokenBalances, CO, createApp, ids, seed, today } from "./helpers.js";

/** Suppliers, supplier invoices (VAT split, unique tax numbers) and payments. */
describe("purchases", () => {
    let app: INestApplication;
    let db: PrismaService;
    let supplierId: string;
    let supplierAccount: string;

    const supplierBody = { name: "Parts Ltd", tin: "T1", address: "Galle", supplierType: "Spare parts", contactNo: "071" };
    const invoiceBody = (over: Record<string, unknown> = {}) => ({
        taxInvoiceNo: "sup000000000001",
        date: today(),
        totalIncludingVat: 1180,
        lineItems: [{ id: "l1", description: "Tyres", quantity: 2 }],
        ...over,
    });
    const pay = (amount: number) => ({
        date: today(),
        description: "Cheque",
        chequeNo: "1",
        amount,
        debitingAccountId: ids.bank,
        creditingAccountId: supplierAccount,
    });
    const base = () => `/companies/${CO}/suppliers/${supplierId}`;

    beforeAll(async () => ({ app, db } = await createApp()));
    afterAll(async () => app.close());
    beforeEach(async () => {
        await seed(db);
        await db.supplierType.create({ data: { companyId: CO, name: "Spare parts" } });
        const created = await as(app, ids.general).post(`/companies/${CO}/suppliers`, supplierBody);
        expect(created.status).toBe(201);
        supplierId = created.body.id;
        supplierAccount = (await db.account.findFirstOrThrow({ where: { supplierId } })).id;
    });
    afterEach(async () => expect(await brokenBalances(db)).toEqual([]));

    it("requires the same fields as the supplier form", async () => {
        const res = await as(app, ids.general).post(`/companies/${CO}/suppliers`, { ...supplierBody, tin: "", address: "" });
        expect(res.status).toBe(400);
        expect(res.body.message).toEqual(["tin: TIN is required", "address: Address is required"]);
    });

    it("renaming a supplier renames its account", async () => {
        const res = await as(app, ids.general).patch(base(), { ...supplierBody, name: "Parts (Pvt) Ltd" });
        expect(res.status).toBe(200);
        expect((await db.account.findUniqueOrThrow({ where: { id: supplierAccount } })).name).toBe("Parts (Pvt) Ltd");
    });

    it("splits VAT out of the total and normalizes the tax number", async () => {
        const res = await as(app, ids.general).post(`${base()}/invoices`, invoiceBody());
        expect(res.status).toBe(201);
        const inv = await db.supplierInvoice.findUniqueOrThrow({ where: { id: res.body.id } });
        expect(inv.taxInvoiceNo).toBe("SUP000000000001");
        expect(Number(inv.billAmount)).toBe(1000);
        expect(Number(inv.vatAmount)).toBe(180);
        expect(Number(inv.outstandingAmount)).toBe(1180);
    });

    it("allows each live tax number once per company, and frees it on delete", async () => {
        const api = as(app, ids.general);
        const first = (await api.post(`${base()}/invoices`, invoiceBody())).body.id;
        const dup = await api.post(`${base()}/invoices`, invoiceBody({ taxInvoiceNo: "SUP000000000001" }));
        expect(dup.status).toBe(400);
        expect(dup.body.message).toBe("Tax invoice no SUP000000000001 already exists for Parts Ltd.");
        expect((await api.delete(`${base()}/invoices/${first}`)).status).toBe(200);
        expect((await api.post(`${base()}/invoices`, invoiceBody())).status).toBe(201);
    });

    it("validates tax number format and line quantities", async () => {
        const api = as(app, ids.general);
        expect((await api.post(`${base()}/invoices`, invoiceBody({ taxInvoiceNo: "SHORT" }))).status).toBe(400);
        const badQty = await api.post(`${base()}/invoices`, invoiceBody({ lineItems: [{ description: "Tyres", quantity: 1.5 }] }));
        expect(badQty.status).toBe(400);
        expect(badQty.body.message).toContain("whole number");
    });

    it("payments move money from our account to the supplier's and track what's outstanding", async () => {
        const api = as(app, ids.general);
        const invoiceId = (await api.post(`${base()}/invoices`, invoiceBody())).body.id;
        const paymentId = (await api.post(`${base()}/invoices/${invoiceId}/payments`, pay(500))).body.id;
        expect(await balance(db, ids.bank)).toBe(500);
        expect(await balance(db, supplierAccount)).toBe(500);

        await api.put(`${base()}/invoices/${invoiceId}/payments/${paymentId}`, pay(600));
        expect(await balance(db, ids.bank)).toBe(400);
        let inv = await db.supplierInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
        expect(Number(inv.outstandingAmount)).toBe(580);
        expect(inv.status).toBe("partial");

        expect((await api.delete(`${base()}/invoices/${invoiceId}`)).status).toBe(400); // has payments
        expect((await api.post(`${base()}/invoices/${invoiceId}/payments`, pay(581))).status).toBe(400); // overpay

        await api.delete(`${base()}/invoices/${invoiceId}/payments/${paymentId}`);
        inv = await db.supplierInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
        expect(Number(inv.outstandingAmount)).toBe(1180);
        expect(inv.status).toBe("issued");
        expect(await balance(db, ids.bank)).toBe(1000);
    });
});
