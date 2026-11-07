import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { cert, initializeApp } from "firebase-admin/app";
import {
    type Firestore,
    getFirestore,
    type QueryDocumentSnapshot,
    Timestamp,
} from "firebase-admin/firestore";
import { type Prisma, PrismaClient } from "../../src/generated/prisma/client.js";

// ── Clients ──────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set in apps/server/.env`);
    return value;
}

export function createClients() {
    const fs = getFirestore(
        initializeApp({
            credential: cert({
                projectId: requireEnv("FIREBASE_PROJECT_ID"),
                clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
                privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
            }),
        }),
    );
    const databaseUrl = requireEnv("DATABASE_URL");
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    return { fs, db, databaseUrl };
}

// ── Run log ──────────────────────────────────────────────────────────────

type Stats = { source: number; written: number; rejected: number };
export type Rejection = { collection: string; path: string; reason: string };

export class MigrationLog {
    readonly stats = new Map<string, Stats>();
    readonly warnings: string[] = [];
    readonly rejects: Rejection[] = [];

    private entry(collection: string): Stats {
        let stats = this.stats.get(collection);
        if (!stats) {
            stats = { source: 0, written: 0, rejected: 0 };
            this.stats.set(collection, stats);
        }
        return stats;
    }

    source(collection: string, count: number) {
        this.entry(collection).source += count;
    }

    written(collection: string) {
        this.entry(collection).written++;
    }

    reject(collection: string, path: string, reason: string) {
        this.entry(collection).rejected++;
        this.rejects.push({ collection, path, reason });
    }

    warn(message: string) {
        this.warnings.push(message);
    }
}

/** Thrown by a converter when a document can't be imported; it is logged, not fatal. */
export class Reject extends Error {}

// ── Shared state between steps ──────────────────────────────────────────

export type Kind =
    | "users"
    | "companies"
    | "accountTypes"
    | "departments"
    | "supplierTypes"
    | "vehicles"
    | "clients"
    | "suppliers"
    | "accounts"
    | "transactions"
    | "invoices"
    | "supplierInvoices";

/** Per company: lower-cased name → row id, for fields Firestore stored by name. */
export type NameIndex = Map<string, Map<string, string>>;

export type Ctx = {
    fs: Firestore;
    db: PrismaClient;
    dryRun: boolean;
    log: MigrationLog;
    /** IDs that were written (or would be, in a dry run). Used to check references. */
    known: Record<Kind, Set<string>>;
    byName: {
        accountTypes: NameIndex;
        departments: NameIndex;
        supplierTypes: NameIndex;
        vehicles: NameIndex;
    };
    /** Totals computed from Firestore, compared against Postgres at the end. */
    expected: {
        vatByQuarter: Map<string, number>; // "companyId|quarterKey" → cents
    };
};

export function createCtx(fs: Firestore, db: PrismaClient, dryRun: boolean): Ctx {
    const set = () => new Set<string>();
    return {
        fs,
        db,
        dryRun,
        log: new MigrationLog(),
        known: {
            users: set(), companies: set(), accountTypes: set(), departments: set(),
            supplierTypes: set(), vehicles: set(), clients: set(), suppliers: set(),
            accounts: set(), transactions: set(), invoices: set(), supplierInvoices: set(),
        },
        byName: { accountTypes: new Map(), departments: new Map(), supplierTypes: new Map(), vehicles: new Map() },
        expected: { vatByQuarter: new Map() },
    };
}

export function rememberName(index: NameIndex, companyId: string, name: string, id: string) {
    let names = index.get(companyId);
    if (!names) {
        names = new Map();
        index.set(companyId, names);
    }
    names.set(name.trim().toLowerCase(), id);
}

export function lookupName(index: NameIndex, companyId: string, name: string): string | undefined {
    return index.get(companyId)?.get(name.trim().toLowerCase());
}

// ── Reading Firestore ────────────────────────────────────────────────────

/** All documents of a collection group whose path matches, e.g. "companies/*\/clients/*". */
export async function docsAt(ctx: Ctx, pattern: string): Promise<QueryDocumentSnapshot[]> {
    const parts = pattern.split("/");
    const group = parts[parts.length - 2];
    const snap = await ctx.fs.collectionGroup(group).get();
    return snap.docs.filter((doc) => {
        const segs = doc.ref.path.split("/");
        return segs.length === parts.length && parts.every((p, i) => p === "*" || p === segs[i]);
    });
}

/** Path segments: for companies/{c}/clients/{id}, seg(doc)[1] is the company ID. */
export const seg = (doc: QueryDocumentSnapshot) => doc.ref.path.split("/");

// ── Value conversion ─────────────────────────────────────────────────────

export const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export function date(value: unknown): Date | undefined {
    if (value instanceof Timestamp) return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return undefined;
}

export function requiredDate(value: unknown, field: string): Date {
    const result = date(value);
    if (!result) throw new Reject(`${field} is missing or not a date`);
    return result;
}

/** Money as a 2-decimal string, so no float rounding reaches numeric(14,2). */
export function money(value: unknown, field: string): string {
    const n = Number(value);
    if (value === undefined || value === null || value === "" || !Number.isFinite(n)) {
        throw new Reject(`${field} is missing or not a number`);
    }
    return (Math.round(n * 100) / 100).toFixed(2);
}

export function moneyOrZero(value: unknown): string {
    const n = Number(value);
    return Number.isFinite(n) ? (Math.round(n * 100) / 100).toFixed(2) : "0.00";
}

export const cents = (value: unknown) => Math.round((Number(value) || 0) * 100);

/** Firestore maps/arrays → plain JSON (Timestamps become ISO strings). */
export function json(value: unknown): Prisma.InputJsonValue {
    const walk = (v: unknown): unknown => {
        if (v instanceof Timestamp) return v.toDate().toISOString();
        if (Array.isArray(v)) return v.map(walk);
        if (v && typeof v === "object") {
            return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
        }
        return v ?? null;
    };
    return walk(value) as Prisma.InputJsonValue;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T, warn: () => void): T {
    if (allowed.includes(value as T)) return value as T;
    warn();
    return fallback;
}

/** A createdBy/updatedBy reference: kept if the user exists, otherwise left empty. */
export function userRef(ctx: Ctx, value: unknown, path: string, field: string): string | null {
    const id = str(value);
    if (!id) return null;
    if (ctx.known.users.has(id)) return id;
    ctx.log.warn(`${path}: ${field} "${id}" is not a known user → left empty`);
    return null;
}

// ── Step runner ──────────────────────────────────────────────────────────

function shortError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    const lines = message.split("\n").map((l) => l.trim()).filter(Boolean);
    return lines[lines.length - 1] ?? message;
}

/**
 * Converts and writes each document. A failure on one document is logged
 * and skipped, so one bad record never stops the run.
 */
export async function migrate<T>(
    ctx: Ctx,
    collection: string,
    docs: QueryDocumentSnapshot[],
    convert: (doc: QueryDocumentSnapshot) => T,
    write: (row: T) => Promise<unknown>,
    remember?: (row: T) => void,
) {
    ctx.log.source(collection, docs.length);
    for (const doc of docs) {
        let row: T;
        try {
            row = convert(doc);
        } catch (error) {
            ctx.log.reject(collection, doc.ref.path, shortError(error));
            continue;
        }
        if (!ctx.dryRun) {
            try {
                await write(row);
            } catch (error) {
                ctx.log.reject(collection, doc.ref.path, shortError(error));
                continue;
            }
        }
        ctx.log.written(collection);
        remember?.(row);
    }
}
