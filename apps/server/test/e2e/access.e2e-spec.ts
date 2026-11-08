import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../src/infra/prisma/prisma.service.js";
import { as, CO, createApp, ids, OTHER_CO, seed } from "./helpers.js";

/** Who may do what: sign-in, removed accounts, roles and company boundaries. */
describe("access", () => {
    let app: INestApplication;
    let db: PrismaService;

    beforeAll(async () => ({ app, db } = await createApp()));
    afterAll(async () => app.close());
    beforeEach(async () => seed(db));

    it("needs a valid token, except for /health", async () => {
        expect((await as(app, null).get("/health")).status).toBe(200);
        expect((await as(app, null).get("/me")).status).toBe(401);
        expect((await as(app, "bad-token").get("/me")).status).toBe(401);
    });

    it("rejects removed accounts and signed-in users without a profile", async () => {
        const removed = await as(app, ids.removed).get("/me");
        expect(removed.status).toBe(403);
        expect(removed.body.message).toMatch(/removed/);
        expect((await as(app, "u-nobody").get("/me")).status).toBe(403);
    });

    it("/me returns the profile and only the user's companies", async () => {
        const res = await as(app, ids.general).get("/me");
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ uid: ids.general, role: "general", companies: [{ id: CO, name: "Main Co" }] });
    });

    it("blocks companies the user doesn't belong to", async () => {
        expect((await as(app, ids.general).get(`/companies/${OTHER_CO}/docs/accounts`)).status).toBe(403);
        expect((await as(app, ids.outsider).get(`/companies/${CO}/lookups`)).status).toBe(403);
        expect((await as(app, ids.general).post(`/companies/${OTHER_CO}/transactions`, {})).status).toBe(403);
    });

    it("can't reach another company's records through your own company", async () => {
        // A client that exists, but in the other company.
        await db.client.create({ data: { id: "cl-other", companyId: OTHER_CO, name: "Theirs" } });
        const api = as(app, ids.admin);
        expect((await api.get(`/companies/${CO}/clients/cl-other`)).status).toBe(404);
        expect((await api.patch(`/companies/${CO}/clients/cl-other/status`, { status: "inactive" })).status).toBe(404);
        const docs = await api.get(`/companies/${CO}/docs/clients/cl-other`);
        expect(docs.body.doc).toBeNull();
    });

    it("only admins and managers manage users, companies and the audit log", async () => {
        const general = as(app, ids.general);
        expect((await general.get("/users")).status).toBe(403);
        expect((await general.get("/audit-logs")).status).toBe(403);
        expect((await general.post("/companies", { name: "X", address: "A", telephoneNo: "1", tin: "T" })).status).toBe(403);
        expect((await as(app, ids.manager).get("/users")).status).toBe(200);
    });

    it("a manager only manages companies they belong to; an admin manages any", async () => {
        const body = { name: "Renamed", address: "A", telephoneNo: "1", tin: "T" };
        expect((await as(app, ids.manager).patch(`/companies/${OTHER_CO}`, body)).status).toBe(403);
        expect((await as(app, ids.admin).patch(`/companies/${OTHER_CO}`, body)).status).toBe(200);
    });

    it("managers see audit entries for their companies only; admins see all", async () => {
        await db.auditLog.createMany({
            data: [
                { companyId: CO, action: "create", description: "ours" },
                { companyId: OTHER_CO, action: "create", description: "theirs" },
            ],
        });
        const manager = await as(app, ids.manager).get("/audit-logs");
        expect(manager.body.map((l: { description: string }) => l.description)).toEqual(["ours"]);
        const admin = await as(app, ids.admin).get("/audit-logs");
        expect(admin.body).toHaveLength(2);
    });

    it("users can't remove themselves, and managers can't remove admins", async () => {
        expect((await as(app, ids.admin).post(`/users/${ids.admin}/remove`)).status).toBe(400);
        expect((await as(app, ids.manager).post(`/users/${ids.admin}/remove`)).status).toBe(403);
    });
});
