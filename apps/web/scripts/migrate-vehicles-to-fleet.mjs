/**
 * Copies vehicles from the old lookup list into the Fleet collection.
 *
 *   lookup-lists/{companyId}/vehicles/{id}  →  companies/{companyId}/vehicles/{id}
 *
 * Originals are left untouched. Existing destination docs are skipped, so the
 * script is safe to re-run.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-vehicles-to-fleet.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-vehicles-to-fleet.mjs
 */
import admin from "firebase-admin";

const dryRun = process.argv.includes("--dry-run");

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } =
  process.env;
if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error("Missing FIREBASE_* env vars. Run with --env-file=.env.local.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = admin.firestore();

console.log(
  `Project: ${FIREBASE_PROJECT_ID}${dryRun ? " (dry run — no writes)" : ""}\n`,
);

// listDocuments() includes parent docs that only exist as subcollection paths.
const companyRefs = await db.collection("lookup-lists").listDocuments();
const totals = { found: 0, created: 0, skipped: 0 };

for (const companyRef of companyRefs) {
  const companyId = companyRef.id;
  const source = await companyRef.collection("vehicles").get();
  if (source.empty) continue;

  const destination = db
    .collection("companies")
    .doc(companyId)
    .collection("vehicles");
  const counts = { found: source.size, created: 0, skipped: 0 };
  let batch = db.batch();
  let pending = 0;

  for (const vehicleDoc of source.docs) {
    const targetRef = destination.doc(vehicleDoc.id);
    if ((await targetRef.get()).exists) {
      counts.skipped++;
      continue;
    }

    const data = vehicleDoc.data();
    counts.created++;
    if (dryRun) continue;

    batch.set(targetRef, {
      ...data,
      description: typeof data.description === "string" ? data.description : "",
      migratedFrom: "lookup-lists",
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    pending++;
    if (pending === 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  if (pending > 0) await batch.commit();

  console.log(
    `${companyId}: found ${counts.found}, ${dryRun ? "would create" : "created"} ${counts.created}, skipped ${counts.skipped} (already migrated)`,
  );
  totals.found += counts.found;
  totals.created += counts.created;
  totals.skipped += counts.skipped;
}

console.log(
  `\nTotal: found ${totals.found}, ${dryRun ? "would create" : "created"} ${totals.created}, skipped ${totals.skipped}`,
);
