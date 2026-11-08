/**
 * Creates the e2e database (if needed) and applies all migrations to it,
 * once before the whole run. The real dev database is never touched.
 */
import { execSync } from "node:child_process";
import pg from "pg";
import { E2E_DATABASE, E2E_DATABASE_URL } from "./env.js";

export default async function setup() {
    const admin = new pg.Client({ connectionString: E2E_DATABASE_URL.replace(`/${E2E_DATABASE}`, "/postgres") });
    await admin.connect();
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [E2E_DATABASE]);
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${E2E_DATABASE}"`);
    await admin.end();
    execSync("npx prisma migrate deploy", {
        env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
        stdio: "ignore",
    });
}
