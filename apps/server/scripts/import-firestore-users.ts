/**
 * Copies `companies` and `users` from Firestore into Postgres, plus the
 * user ↔ company links (`users.companies` array → `user_companies` rows).
 *
 * Read-only on Firestore. Safe to re-run: every row is upserted by its
 * Firestore document ID, so running it again just refreshes the data.
 *
 *   npm run import:users -- --dry-run   # report only, writes nothing
 *   npm run import:users                # write to DATABASE_URL
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { PrismaClient, Role } from "../src/generated/prisma/client.js";

const dryRun = process.argv.includes("--dry-run");

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set in apps/server/.env`);
    return value;
}

const firestore = getFirestore(
    initializeApp({
        credential: cert({
            projectId: requireEnv("FIREBASE_PROJECT_ID"),
            clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
            privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
        }),
    }),
);

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv("DATABASE_URL") }),
});

const ROLES = new Set<string>(Object.values(Role));
const warnings: string[] = [];

function str(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function date(value: unknown): Date | undefined {
    if (value instanceof Timestamp) return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return undefined;
}

async function main() {
    console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "WRITE"}\n`);

    // ── Companies ────────────────────────────────────────────────────────
    const companySnap = await firestore.collection("companies").get();
    const companies = companySnap.docs.map((doc) => {
        const d = doc.data();
        return {
            id: doc.id,
            name: str(d.name) || doc.id,
            address: str(d.address),
            telephoneNo: str(d.telephoneNo),
            tin: str(d.tin),
            entityStatus: d.entityStatus !== false,
            createdAt: date(d.createdAt),
        };
    });
    const companyIds = new Set(companies.map((c) => c.id));

    // ── Users + links ────────────────────────────────────────────────────
    const userSnap = await firestore.collection("users").get();
    const links: { userId: string; companyId: string }[] = [];
    const users = userSnap.docs.map((doc) => {
        const d = doc.data();

        let role = str(d.role);
        if (!ROLES.has(role)) {
            warnings.push(`user ${doc.id}: unknown role "${role}" → imported as "general"`);
            role = Role.general;
        }

        const memberOf = Array.isArray(d.companies) ? d.companies : [];
        for (const companyId of memberOf) {
            if (typeof companyId !== "string" || !companyIds.has(companyId)) {
                warnings.push(`user ${doc.id}: company "${String(companyId)}" not found → link skipped`);
                continue;
            }
            links.push({ userId: doc.id, companyId });
        }

        if (!str(d.email)) warnings.push(`user ${doc.id}: no email`);

        return {
            id: doc.id,
            username: str(d.username) || str(d.email) || doc.id,
            email: str(d.email),
            role: role as Role,
            firstSignIn: d.firstSignIn === true,
            entityStatus: d.entityStatus !== false,
            createdAt: date(d.createdAt),
        };
    });

    console.log(`Firestore: ${companies.length} companies, ${users.length} users, ${links.length} user↔company links`);
    console.log(
        `  active: ${companies.filter((c) => c.entityStatus).length} companies, ${users.filter((u) => u.entityStatus).length} users`,
    );
    if (warnings.length) {
        console.log(`\nWarnings (${warnings.length}):`);
        for (const w of warnings) console.log(`  - ${w}`);
    }

    if (dryRun) return;

    // ── Write (one transaction: all or nothing) ──────────────────────────
    await prisma.$transaction(async (tx) => {
        for (const { id, ...data } of companies) {
            await tx.company.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        for (const { id, ...data } of users) {
            await tx.user.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        // Links mirror Firestore exactly: drop the old set, insert the current one.
        await tx.userCompany.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
        await tx.userCompany.createMany({ data: links, skipDuplicates: true });
    });

    // ── Verify ───────────────────────────────────────────────────────────
    const [pgCompanies, pgUsers, pgLinks] = await Promise.all([
        prisma.company.count(),
        prisma.user.count(),
        prisma.userCompany.count(),
    ]);
    console.log(`\nPostgres now: ${pgCompanies} companies, ${pgUsers} users, ${pgLinks} links`);
    const ok = pgCompanies >= companies.length && pgUsers >= users.length && pgLinks === links.length;
    console.log(ok ? "✔ Counts match Firestore" : "✘ Counts do not match — check the warnings above");
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
