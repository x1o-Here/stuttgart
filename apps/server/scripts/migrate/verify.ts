import type { Ctx } from "./context.js";

export type Check = { name: string; ok: boolean; details: string[] };

/** Postgres table holding each migrated collection. */
const TABLES: Record<string, string> = {
    users: "users",
    companies: "companies",
    user_companies: "users", // one Firestore user doc → its link rows
    account_types: "account_types",
    departments: "departments",
    supplier_types: "supplier_types",
    vehicles: "vehicles",
    clients: "clients",
    suppliers: "suppliers",
    accounts: "accounts",
    transactions: "transactions",
    invoice_templates: "invoice_templates",
    invoices: "invoices",
    invoice_payments: "invoice_payments",
    supplier_invoices: "supplier_invoices",
    supplier_payments: "supplier_payments",
    vat_payments: "vat_payments",
    spare_parts: "spare_parts",
    reports: "reports",
    audit_logs: "audit_logs",
};

const lkr = (v: unknown) => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function verify(ctx: Ctx): Promise<Check[]> {
    const checks: Check[] = [];
    const q = <T>(sql: string) => ctx.db.$queryRawUnsafe<T[]>(sql);

    // 1. Every Firestore document either landed in Postgres or was rejected (and logged).
    const counts: string[] = [];
    for (const [collection, stats] of ctx.log.stats) {
        if (stats.source !== stats.written + stats.rejected) {
            counts.push(`${collection}: ${stats.source} in Firestore but ${stats.written} written + ${stats.rejected} rejected`);
        }
        const table = TABLES[collection];
        if (table && collection !== "user_companies") {
            const [{ n }] = await q<{ n: bigint }>(`SELECT count(*) AS n FROM "${table}"`);
            if (Number(n) < stats.written) counts.push(`${collection}: ${stats.written} written but only ${n} rows in ${table}`);
        }
    }
    checks.push({ name: "Row counts match Firestore", ok: counts.length === 0, details: counts });

    // 2. Account balance = initial balance + credits − debits (how the app updates balances).
    const balances = await q<{ name: string; balance: string; expected: string }>(`
        SELECT a.name, a.balance::text, (a.initial_balance + COALESCE(c.s, 0) - COALESCE(d.s, 0))::text AS expected
        FROM accounts a
        LEFT JOIN (SELECT credit_account_id AS id, SUM(amount) AS s FROM transactions GROUP BY 1) c ON c.id = a.id
        LEFT JOIN (SELECT debit_account_id  AS id, SUM(amount) AS s FROM transactions GROUP BY 1) d ON d.id = a.id
        WHERE a.balance <> a.initial_balance + COALESCE(c.s, 0) - COALESCE(d.s, 0)
        ORDER BY a.name`);
    checks.push({
        name: "Account balances match their transactions",
        ok: balances.length === 0,
        details: balances.map((r) => `${r.name}: stored ${lkr(r.balance)}, transactions give ${lkr(r.expected)}`),
    });

    // 3. Sales invoices: lines add up, VAT adds up, outstanding = total − active payments.
    const invoices = await q<{ tax_invoice_no: string; problem: string }>(`
        WITH lines AS (SELECT invoice_id, SUM(amount) AS s FROM invoice_line_items GROUP BY 1),
             paid  AS (SELECT invoice_id, SUM(amount) AS s FROM invoice_payments WHERE entity_status GROUP BY 1)
        SELECT i.tax_invoice_no, 'line items sum to ' || COALESCE(l.s, 0) || ', total is ' || i.total_amount AS problem
          FROM invoices i LEFT JOIN lines l ON l.invoice_id = i.id
         WHERE i.entity_status AND COALESCE(l.s, 0) <> i.total_amount
        UNION ALL
        SELECT i.tax_invoice_no, 'total ' || i.total_amount || ' + VAT ' || i.vat_amount || ' ≠ ' || i.total_including_vat
          FROM invoices i
         WHERE i.entity_status AND abs(i.total_amount + i.vat_amount - i.total_including_vat) > 0.01
        UNION ALL
        SELECT i.tax_invoice_no, 'outstanding ' || i.outstanding_amount || ' but total − payments = ' || (i.total_including_vat - COALESCE(p.s, 0))
          FROM invoices i LEFT JOIN paid p ON p.invoice_id = i.id
         WHERE i.entity_status AND i.status <> 'cancelled'
           AND abs(i.outstanding_amount - greatest(0, i.total_including_vat - COALESCE(p.s, 0))) > 0.01`);
    checks.push({
        name: "Sales invoice totals add up",
        ok: invoices.length === 0,
        details: invoices.map((r) => `${r.tax_invoice_no || "(no tax no)"}: ${r.problem}`),
    });

    // 4. Supplier invoices: bill + VAT = total, outstanding = total − active payments.
    const purchases = await q<{ tax_invoice_no: string; problem: string }>(`
        WITH paid AS (SELECT supplier_invoice_id, SUM(amount) AS s FROM supplier_payments WHERE entity_status GROUP BY 1)
        SELECT si.tax_invoice_no, 'bill ' || si.bill_amount || ' + VAT ' || si.vat_amount || ' ≠ ' || si.total_including_vat AS problem
          FROM supplier_invoices si
         WHERE si.entity_status AND si.bill_amount + si.vat_amount <> si.total_including_vat
        UNION ALL
        SELECT si.tax_invoice_no, 'outstanding ' || si.outstanding_amount || ' but total − payments = ' || (si.total_including_vat - COALESCE(p.s, 0))
          FROM supplier_invoices si LEFT JOIN paid p ON p.supplier_invoice_id = si.id
         WHERE si.entity_status AND abs(si.outstanding_amount - greatest(0, si.total_including_vat - COALESCE(p.s, 0))) > 0.01`);
    checks.push({
        name: "Supplier invoice totals add up",
        ok: purchases.length === 0,
        details: purchases.map((r) => `${r.tax_invoice_no}: ${r.problem}`),
    });

    // 5. VAT paid per quarter equals what Firestore had.
    const vatRows = await q<{ company_id: string; quarter_key: string; cents: bigint }>(`
        SELECT company_id, quarter_key, round(SUM(amount) * 100)::bigint AS cents
          FROM vat_payments WHERE entity_status GROUP BY 1, 2`);
    const actual = new Map(vatRows.map((r) => [`${r.company_id}|${r.quarter_key}`, Number(r.cents)]));
    const vat: string[] = [];
    for (const key of new Set([...ctx.expected.vatByQuarter.keys(), ...actual.keys()])) {
        const want = ctx.expected.vatByQuarter.get(key) ?? 0;
        const got = actual.get(key) ?? 0;
        if (want !== got) vat.push(`${key}: Firestore ${lkr(want / 100)}, Postgres ${lkr(got / 100)}`);
    }
    checks.push({ name: "VAT paid per quarter matches", ok: vat.length === 0, details: vat });

    return checks;
}
