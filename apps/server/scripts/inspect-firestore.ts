/**
 * Read-only inventory of the Firestore database: every collection (including
 * subcollections), how many documents it has, where it lives, and which fields
 * appear with which types. Prints field names and types only, never values.
 *
 *   npx tsx scripts/inspect-firestore.ts [sampleSize=1000]
 */
import "dotenv/config";
import { cert, initializeApp } from "firebase-admin/app";
import {
    type CollectionReference,
    DocumentReference,
    getFirestore,
    GeoPoint,
    Timestamp,
} from "firebase-admin/firestore";

const SAMPLE = Number(process.argv[2] ?? 1000);

/** Collection names referenced in apps/web. */
const KNOWN_GROUPS = [
    "account-types", "departments", "supplier-types", "vehicles",
    "accounts", "transactions", "clients", "invoices", "payments", "invoice-template",
    "suppliers", "sparePartIds", "spareParts", "supplierInvoiceNos",
    "vatPayments", "reports", "auditLogs", "users", "companies",
];

const db = getFirestore(
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
    }),
);

function typeOf(v: unknown): string {
    if (v === null) return "null";
    if (v instanceof Timestamp) return "timestamp";
    if (v instanceof DocumentReference) return "ref";
    if (v instanceof GeoPoint) return "geo";
    if (Array.isArray(v)) {
        const inner = [...new Set(v.map(typeOf))].sort().join("|");
        return `array<${inner || "empty"}>`;
    }
    if (typeof v === "object") return "map";
    if (typeof v === "number") return Number.isInteger(v) ? "int" : "float";
    return typeof v;
}

type FieldStats = Map<string, { count: number; types: Set<string> }>;

function collect(stats: FieldStats, data: Record<string, unknown>, prefix = "", depth = 0) {
    for (const [key, value] of Object.entries(data)) {
        const name = prefix + key;
        const entry = stats.get(name) ?? { count: 0, types: new Set<string>() };
        entry.count++;
        entry.types.add(typeOf(value));
        stats.set(name, entry);
        if (depth < 2 && value && typeof value === "object" && !Array.isArray(value) && typeOf(value) === "map") {
            collect(stats, value as Record<string, unknown>, `${name}.`, depth + 1);
        }
        if (depth < 2 && Array.isArray(value)) {
            for (const item of value) {
                if (typeOf(item) === "map") collect(stats, item as Record<string, unknown>, `${name}[].`, depth + 1);
            }
        }
    }
}

/** Finds collection-group names and their path patterns by walking a sample of documents. */
async function discover(cols: CollectionReference[], found: Map<string, Set<string>>) {
    for (const col of cols) {
        const pattern = col.path.split("/").map((seg, i) => (i % 2 ? "{id}" : seg)).join("/");
        const set = found.get(col.id) ?? new Set<string>();
        set.add(pattern);
        found.set(col.id, set);
        const docs = await col.limit(25).get();
        for (const doc of docs.docs) {
            await discover(await doc.ref.listCollections(), found);
        }
    }
}

async function main() {
    const found = new Map<string, Set<string>>();
    await discover(await db.listCollections(), found);

    // Subcollections under parent docs that don't exist (e.g. lookup-lists/{companyId}/...)
    // are invisible to listCollections(), so also check every name the app code uses.
    for (const name of KNOWN_GROUPS) {
        if (found.has(name)) continue;
        const snap = await db.collectionGroup(name).limit(25).get();
        if (snap.empty) continue;
        const patterns = new Set(
            snap.docs.map((d) => d.ref.path.split("/").map((seg, i) => (i % 2 ? "{id}" : seg)).slice(0, -1).join("/")),
        );
        found.set(name, patterns);
    }

    for (const [group, patterns] of [...found].sort()) {
        const total = (await db.collectionGroup(group).count().get()).data().count;
        const snap = await db.collectionGroup(group).limit(SAMPLE).get();
        const stats: FieldStats = new Map();
        for (const doc of snap.docs) collect(stats, doc.data());

        console.log(`\n## ${group}  (${total} docs, sampled ${snap.size})`);
        console.log(`   paths: ${[...patterns].join(", ")}`);
        for (const [name, { count, types }] of [...stats].sort()) {
            const pct = Math.round((count / Math.max(snap.size, 1)) * 100);
            console.log(`   ${name.padEnd(36)} ${[...types].sort().join(" | ").padEnd(28)} ${pct}%`);
        }
    }
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
