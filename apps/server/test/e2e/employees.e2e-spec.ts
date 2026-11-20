import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../src/infra/prisma/prisma.service.js";
import { as, CO, createApp, ids, OTHER_CO, seed } from "./helpers.js";

/** Employees: each gets an "EMP_<name>" account; the company gets one EPF and one ETF account. */
describe("employees", () => {
    let app: INestApplication;
    let db: PrismaService;
    const base = (co = CO) => `/companies/${co}/employees`;
    const body = (over: object = {}) => ({ employeeNo: "E001", name: "Nimal Perera", role: "Driver", ...over });

    beforeAll(async () => ({ app, db } = await createApp()));
    afterAll(async () => app.close());
    beforeEach(async () => seed(db));

    it("creates an employee with their EMP_ account under the system Employee type", async () => {
        const res = await as(app, ids.general).post(base(), body({ name: "  Nimal Perera ", employeeNo: " E001 " }));
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ employeeNo: "E001", name: "Nimal Perera", role: "Driver" });

        const row = await db.employee.findUniqueOrThrow({ where: { id: res.body.id } });
        expect(row).toMatchObject({ companyId: CO, createdById: ids.general, entityStatus: true });

        const account = await db.account.findFirstOrThrow({
            where: { employeeId: res.body.id },
            include: { accountType: true },
        });
        expect(account.id).toBe(res.body.accountId);
        expect(account.name).toBe("EMP_Nimal Perera");
        expect(account.accountType.name).toBe("Employee");
        expect(account.accountType.isSystem).toBe(true);

        const list = await as(app, ids.general).get(base());
        expect(list.status).toBe(200);
        expect(list.body.map((e: { name: string }) => e.name)).toEqual(["Nimal Perera"]);
        const docs = await as(app, ids.general).get(`/companies/${CO}/docs/employees`);
        expect(docs.body.docs[0].data).toMatchObject({ employeeNo: "E001", accountName: "EMP_Nimal Perera" });
    });

    it("creates one EPF and one ETF account per company, not per employee", async () => {
        const api = as(app, ids.general);
        expect((await api.post(base(), body())).status).toBe(201);
        expect((await api.post(base(), body({ employeeNo: "E002", name: "Kamal" }))).status).toBe(201);
        await Promise.all([
            api.post(base(), body({ employeeNo: "E003", name: "Sunil" })),
            api.post(base(), body({ employeeNo: "E004", name: "Ruwan" })),
        ]);
        for (const name of ["EPF", "ETF"]) {
            const accounts = await db.account.findMany({ where: { companyId: CO, name }, include: { accountType: true } });
            expect(accounts).toHaveLength(1);
            expect(accounts[0].accountType.name).toBe("Employee");
            expect(accounts[0].employeeId).toBeNull();
        }
        expect(await db.account.count({ where: { companyId: CO, name: { startsWith: "EMP_" } } })).toBe(4);
        expect(await db.accountType.count({ where: { companyId: CO, name: "Employee" } })).toBe(1);
        // The other company is untouched.
        expect(await db.account.count({ where: { companyId: OTHER_CO, name: { in: ["EPF", "ETF"] } } })).toBe(0);
    });

    it("reuses existing EPF / ETF accounts", async () => {
        await db.account.create({ data: { companyId: CO, name: "epf", accountTypeId: ids.bankType } });
        expect((await as(app, ids.general).post(base(), body())).status).toBe(201);
        expect(await db.account.count({ where: { companyId: CO, name: { equals: "EPF", mode: "insensitive" } } })).toBe(1);
        expect(await db.account.count({ where: { companyId: CO, name: "ETF" } })).toBe(1);
    });

    it("rejects a duplicate employee number in the same company, and saves nothing", async () => {
        const api = as(app, ids.general);
        expect((await api.post(base(), body())).status).toBe(201);
        const dup = await api.post(base(), body({ name: "Someone Else" }));
        expect(dup.status).toBe(409);
        expect(dup.body.message).toMatch(/E001/);
        expect(await db.employee.count()).toBe(1);
        expect(await db.account.count({ where: { name: "EMP_Someone Else" } })).toBe(0);

        // The same number is fine in another company, and once the old employee is deleted.
        expect((await as(app, ids.outsider).post(base(OTHER_CO), body())).status).toBe(201);
        await db.employee.updateMany({ where: { companyId: CO }, data: { entityStatus: false } });
        expect((await api.post(base(), body({ name: "Rehired" }))).status).toBe(201);
    });

    it("validates the input", async () => {
        const res = await as(app, ids.general).post(base(), { employeeNo: "", name: "X", role: "" });
        expect(res.status).toBe(400);
        expect(await db.employee.count()).toBe(0);
    });

    it("updating renames the employee's account and rejects a taken number", async () => {
        const api = as(app, ids.general);
        const a = await api.post(base(), body());
        await api.post(base(), body({ employeeNo: "E002", name: "Kamal" }));
        const res = await api.patch(`${base()}/${a.body.id}`, body({ name: "Nimal Silva", role: "Supervisor" }));
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ name: "Nimal Silva", role: "Supervisor" });
        const account = await db.account.findFirstOrThrow({ where: { employeeId: a.body.id } });
        expect(account.name).toBe("EMP_Nimal Silva");
        expect((await db.employee.findUniqueOrThrow({ where: { id: a.body.id } })).updatedById).toBe(ids.general);
        expect((await api.patch(`${base()}/${a.body.id}`, body({ employeeNo: "E002" }))).status).toBe(409);
    });

    it("blocks other companies and their employees", async () => {
        expect((await as(app, null).get(base())).status).toBe(401);
        expect((await as(app, ids.outsider).get(base())).status).toBe(403);
        expect((await as(app, ids.outsider).post(base(), body())).status).toBe(403);
        expect((await as(app, ids.removed).post(base(), body())).status).toBe(403);
        expect(await db.employee.count()).toBe(0);

        const theirs = await as(app, ids.outsider).post(base(OTHER_CO), body());
        expect(theirs.status).toBe(201);
        const api = as(app, ids.admin);
        expect((await api.patch(`${base()}/${theirs.body.id}`, body({ name: "Hijacked" }))).status).toBe(404);
        expect((await api.get(base())).body).toEqual([]);
        expect((await api.get(`/companies/${CO}/docs/employees/${theirs.body.id}`)).body.doc).toBeNull();
    });
});
