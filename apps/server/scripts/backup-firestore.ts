/**
 * Full, read-only backup of Firestore to a local JSON file — every collection
 * and subcollection, including subcollections under parent docs that don't
 * exist themselves (e.g. lookup-lists/{companyId}/...). Works without a paid
 * plan, unlike `gcloud firestore export`.
 *
 *   npm run backup:firestore -w @stuttgart/server
 *
 * Writes apps/server/backups/firestore-<time>.json (gitignored):
 *   { exportedAt, projectId, counts: {group: n}, docs: { "path/to/doc": data } }
 * Timestamps are stored as { "__timestamp": "<ISO>" } and document
 * references as { "__ref": "<path>" }, so the file can be restored exactly.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import {
    type CollectionReference,
    DocumentReference,
    GeoPoint,
    getFirestore,
    Timestamp,
} from "firebase-admin/firestore";

const db = getFirestore(
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
    }),
);

function encode(value: unknown): unknown {
    if (value instanceof Timestamp) return { __timestamp: value.toDate().toISOString() };
    if (value instanceof DocumentReference) return { __ref: value.path };
    if (value instanceof GeoPoint) return { __geo: [value.latitude, value.longitude] };
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
    }
    return value;
}

const docs: Record<string, unknown> = {};
const counts: Record<string, number> = {};

async function walk(collection: CollectionReference) {
    // listDocuments() also returns "missing" parent docs that only hold subcollections.
    const refs = await collection.listDocuments();
    for (let i = 0; i < refs.length; i += 300) {
        const chunk = refs.slice(i, i + 300);
        const snaps = await db.getAll(...chunk);
        for (const snap of snaps) {
            if (!snap.exists) continue;
            docs[snap.ref.path] = encode(snap.data());
            counts[collection.id] = (counts[collection.id] ?? 0) + 1;
        }
    }
    for (const ref of refs) {
        for (const sub of await ref.listCollections()) await walk(sub);
    }
}

async function main() {
    const started = Date.now();
    for (const collection of await db.listCollections()) await walk(collection);

    const body = JSON.stringify(
        { exportedAt: new Date().toISOString(), projectId: process.env.FIREBASE_PROJECT_ID, counts, docs },
        null,
        1,
    );
    mkdirSync("backups", { recursive: true });
    const file = `backups/firestore-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(file, body);
    const sha = createHash("sha256").update(body).digest("hex").slice(0, 16);

    console.log(`Backed up ${Object.keys(docs).length} documents in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    for (const [group, n] of Object.entries(counts).sort()) console.log(`  ${group.padEnd(22)} ${n}`);
    console.log(`File: apps/server/${file}  (${(body.length / 1024).toFixed(0)} KB, sha256 ${sha}…)`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
