import type { INestApplication } from "@nestjs/common";

// Must be set before AppModule (and its ConfigModule) is imported.
vi.hoisted(() => {
    process.env.MAINTENANCE_MODE = "1";
});

import type { PrismaService } from "../../src/infra/prisma/prisma.service.js";
import { as, CO, createApp, ids, seed, today } from "./helpers.js";

/** The cutover switch: writes refused with 503, reads still served. */
describe("maintenance mode", () => {
    let app: INestApplication;
    let db: PrismaService;

    beforeAll(async () => ({ app, db } = await createApp()));
    afterAll(async () => {
        delete process.env.MAINTENANCE_MODE;
        await app.close();
    });
    beforeEach(async () => seed(db));

    it("refuses writes but keeps reads working", async () => {
        const api = as(app, ids.general);
        const write = await api.post(`/companies/${CO}/transactions`, {
            date: today(),
            description: "x",
            department: "Operations",
            creditingAccount: ids.bank,
            debitingAccount: ids.cash,
            amount: 1,
        });
        expect(write.status).toBe(503);
        expect(write.body.message).toMatch(/Saving is paused/);
        expect(await db.transaction.count()).toBe(0);
        expect((await api.get(`/companies/${CO}/docs/accounts`)).status).toBe(200);
        expect((await as(app, null).get("/health")).status).toBe(200);
    });
});
