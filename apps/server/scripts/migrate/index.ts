/**
 * Firestore → Postgres migration. Reads Firestore only; writes to DATABASE_URL.
 *
 *   npm run migrate:firestore -- --dry-run   convert + check everything, write nothing
 *   npm run migrate:firestore                upsert everything (safe to repeat)
 *   npm run migrate:firestore -- --reset     empty all tables first, then import
 *                                            (local databases only)
 *
 * Every run writes a full report to apps/server/migration-logs/<time>.json.
 * Exit code 1 means something was rejected or a verification check failed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClients, createCtx } from "./context.js";
import { migrateIdentity } from "./steps/identity.js";
import { migrateLedger } from "./steps/ledger.js";
import { migrateLookups } from "./steps/lookups.js";
import { migrateAuditLogs, migrateReports, migrateSpareParts, migrateVatPayments } from "./steps/other.js";
import { migrateParties } from "./steps/parties.js";
import { migratePurchases } from "./steps/purchases.js";
import { migrateSales } from "./steps/sales.js";
import { type Check, verify } from "./verify.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const reset = args.includes("--reset");

async function main() {
    const { fs, db, databaseUrl } = createClients();
    const target = new URL(databaseUrl);
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(target.hostname);

    console.log(`Firestore project: ${process.env.FIREBASE_PROJECT_ID}`);
    console.log(`Postgres target:   ${target.hostname}:${target.port}${target.pathname}`);
    console.log(`Mode:              ${dryRun ? "DRY RUN (no writes)" : reset ? "RESET + IMPORT" : "UPSERT"}\n`);

    if (reset && !dryRun) {
        if (!isLocal) throw new Error("--reset only runs against a local database.");
        const tables = await db.$queryRawUnsafe<{ tablename: string }[]>(
            `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
        );
        await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
        console.log(`Emptied ${tables.length} tables.\n`);
    }

    const ctx = createCtx(fs, db, dryRun);
    const started = Date.now();

    // Dependency order: each step only references rows from earlier steps.
    const steps: [string, (c: typeof ctx) => Promise<void>][] = [
        ["Users & companies", migrateIdentity],
        ["Lookup lists & vehicles", migrateLookups],
        ["Clients & suppliers", migrateParties],
        ["Accounts & transactions", migrateLedger],
        ["Sales invoices & payments", migrateSales],
        ["Supplier invoices & payments", migratePurchases],
        ["VAT payments", migrateVatPayments],
        ["Spare parts", migrateSpareParts],
        ["Reports", migrateReports],
        ["Audit logs", migrateAuditLogs],
    ];
    for (const [label, step] of steps) {
        process.stdout.write(`→ ${label}… `);
        await step(ctx);
        console.log("done");
    }

    // ── Summary ──
    console.log("\nCollection            Firestore  Written  Rejected");
    for (const [name, s] of ctx.log.stats) {
        console.log(
            `${name.padEnd(20)} ${String(s.source).padStart(10)} ${String(s.written).padStart(8)} ${String(s.rejected).padStart(9)}`,
        );
    }

    if (ctx.log.rejects.length) {
        console.log(`\nRejected (${ctx.log.rejects.length}):`);
        for (const r of ctx.log.rejects.slice(0, 25)) console.log(`  ✘ ${r.path}\n      ${r.reason}`);
        if (ctx.log.rejects.length > 25) console.log(`  … and ${ctx.log.rejects.length - 25} more in the log file`);
    }
    if (ctx.log.warnings.length) {
        console.log(`\nWarnings (${ctx.log.warnings.length}):`);
        for (const w of ctx.log.warnings.slice(0, 25)) console.log(`  ! ${w}`);
        if (ctx.log.warnings.length > 25) console.log(`  … and ${ctx.log.warnings.length - 25} more in the log file`);
    }

    let checks: Check[] = [];
    if (!dryRun) {
        checks = await verify(ctx);
        console.log("\nVerification:");
        for (const c of checks) {
            console.log(`  ${c.ok ? "✔" : "✘"} ${c.name}`);
            for (const d of c.details.slice(0, 10)) console.log(`      ${d}`);
            if (c.details.length > 10) console.log(`      … and ${c.details.length - 10} more in the log file`);
        }
    }

    // ── Log file ──
    mkdirSync("migration-logs", { recursive: true });
    const file = `migration-logs/${new Date().toISOString().replace(/[:.]/g, "-")}${dryRun ? "-dry-run" : ""}.json`;
    writeFileSync(
        file,
        JSON.stringify(
            {
                startedAt: new Date(started).toISOString(),
                seconds: (Date.now() - started) / 1000,
                mode: dryRun ? "dry-run" : reset ? "reset" : "upsert",
                target: `${target.hostname}:${target.port}${target.pathname}`,
                stats: Object.fromEntries(ctx.log.stats),
                rejects: ctx.log.rejects,
                warnings: ctx.log.warnings,
                checks,
            },
            null,
            2,
        ),
    );

    const failed = ctx.log.rejects.length > 0 || checks.some((c) => !c.ok);
    console.log(`\n${failed ? "✘ Finished with problems" : "✔ Finished cleanly"} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.log(`Full report: apps/server/${file}`);
    await db.$disconnect();
    process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
