/**
 * Transitional read model for the Firestore → Postgres switch.
 *
 * The web app's screens were written against Firestore documents. Instead of
 * rewriting ~30 screens at once, this service answers the same paths
 * (e.g. clients/{id}/invoices) with records shaped like the old documents,
 * built from Postgres. Writes do NOT go through here — they use the real
 * endpoints (ledger, sales, purchases, …), each one SQL transaction.
 *
 * Once Firestore is gone, screens can move to typed endpoints one at a time
 * and this module shrinks away.
 */
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service.js";

export type DocData = Record<string, unknown>;
export type Doc = { id: string; data: DocData };
export type ReadResult = { docs: Doc[] } | { doc: Doc | null };

const num = (v: unknown) => Number(v ?? 0);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const quarterLabel = (key: string) => key.replace(/^(\d{4})-(\d{2})-Q(\d)$/, "$1/$2 Q$3");

@Injectable()
export class ReadModelService {
    constructor(private readonly prisma: PrismaService) {}

    async read(companyId: string, path: string): Promise<ReadResult> {
        const s = path.split("/").filter(Boolean);
        const [a, b, c, d, e, f] = s;
        const is = (...pattern: string[]) =>
            s.length === pattern.length && pattern.every((p, i) => p === "*" || p === s[i]);

        if (s.length === 0) return { doc: await this.company(companyId) };
        if (is("accounts")) return { docs: await this.accounts(companyId) };
        if (is("accounts", "*")) return { doc: (await this.accounts(companyId, b))[0] ?? null };
        if (is("accounts", "*", "transactions")) {
            return { docs: (await this.ledger(companyId, [b]))[b] ?? [] };
        }
        if (is("clients")) return { docs: await this.clients(companyId) };
        if (is("clients", "*")) return { doc: (await this.clients(companyId, b))[0] ?? null };
        if (is("clients", "*", "invoices")) return { docs: await this.invoices(companyId, b) };
        if (is("clients", "*", "invoices", "*")) return { doc: (await this.invoices(companyId, b, d))[0] ?? null };
        if (is("clients", "*", "invoices", "*", "payments")) return { docs: await this.invoicePayments(companyId, b, d) };
        if (is("clients", "*", "invoice-template")) return { docs: await this.templates(companyId, b) };
        if (is("clients", "*", "invoice-template", "config")) {
            return { doc: (await this.templates(companyId, b))[0] ?? null };
        }
        if (is("suppliers")) return { docs: await this.suppliers(companyId) };
        if (is("suppliers", "*")) return { doc: (await this.suppliers(companyId, b))[0] ?? null };
        if (is("suppliers", "*", "invoices")) return { docs: await this.supplierInvoices(companyId, b) };
        if (is("suppliers", "*", "invoices", "*")) {
            return { doc: (await this.supplierInvoices(companyId, b, d))[0] ?? null };
        }
        if (is("suppliers", "*", "invoices", "*", "payments")) {
            return { docs: await this.supplierPayments(companyId, b, d) };
        }
        if (is("vatPayments")) return { docs: await this.vatPayments(companyId) };
        if (is("reports")) return { docs: await this.reports(companyId) };
        if (is("reports", "*")) return { doc: (await this.reports(companyId, b))[0] ?? null };
        if (is("spareParts")) return { docs: await this.spareParts(companyId) };
        void [a, c, e, f];
        throw new BadRequestException(`Unknown path: ${path}`);
    }

    // ── Company ─────────────────────────────────────────────────────────

    private async company(companyId: string): Promise<Doc | null> {
        const c = await this.prisma.company.findUnique({ where: { id: companyId } });
        if (!c) return null;
        return {
            id: c.id,
            data: { id: c.id, name: c.name, address: c.address, telephoneNo: c.telephoneNo, tin: c.tin, entityStatus: c.entityStatus },
        };
    }

    // ── Ledger ──────────────────────────────────────────────────────────

    async accounts(companyId: string, id?: string): Promise<Doc[]> {
        const rows = await this.prisma.account.findMany({
            where: { companyId, ...(id ? { id } : {}) },
            include: { accountType: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({
            id: r.id,
            data: {
                name: r.name,
                accountType: r.accountType.name,
                balance: num(r.balance),
                initialBalance: num(r.initialBalance),
                ...(r.clientId ? { clientId: r.clientId } : {}),
                ...(r.supplierId ? { supplierId: r.supplierId } : {}),
                entityStatus: r.entityStatus,
                createdAt: iso(r.createdAt),
            },
        }));
    }

    /**
     * Per-account ledger entries, as Firestore stored them: one transaction
     * appears under its debited account as type "debit" and under its credited
     * account as type "credit".
     */
    async ledger(companyId: string, accountIds: string[]): Promise<Record<string, Doc[]>> {
        const rows = await this.prisma.transaction.findMany({
            where: {
                companyId,
                OR: [{ debitAccountId: { in: accountIds } }, { creditAccountId: { in: accountIds } }],
            },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            include: {
                department: { select: { name: true } },
                vehicle: { select: { name: true } },
                invoicePayment: {
                    select: { id: true, invoice: { select: { id: true, taxInvoiceNo: true, clientSnapshot: true } } },
                },
                supplierPayment: {
                    select: {
                        id: true,
                        supplierInvoice: {
                            select: { id: true, taxInvoiceNo: true, supplier: { select: { id: true, name: true } } },
                        },
                    },
                },
                vatPayment: { select: { id: true } },
            },
        });
        const out: Record<string, Doc[]> = Object.fromEntries(accountIds.map((id) => [id, []]));
        for (const t of rows) {
            const base: DocData = {
                date: iso(t.date),
                amount: num(t.amount),
                department: t.department?.name ?? "",
                vehicle: t.vehicle?.name ?? "",
                voucherNo: t.voucherNo ?? 0,
                description: t.description,
                chequeNo: t.chequeNo,
                tags: t.tags,
                createdAt: iso(t.createdAt),
                updatedAt: iso(t.updatedAt),
            };
            if (t.invoicePayment) {
                const inv = t.invoicePayment.invoice;
                Object.assign(base, {
                    invoiceId: inv.id,
                    invoiceNo: inv.taxInvoiceNo,
                    clientName: (inv.clientSnapshot as { name?: string } | null)?.name ?? "",
                    paymentId: t.invoicePayment.id,
                });
            }
            if (t.supplierPayment) {
                const inv = t.supplierPayment.supplierInvoice;
                Object.assign(base, {
                    supplierId: inv.supplier.id,
                    supplierName: inv.supplier.name,
                    supplierInvoiceId: inv.id,
                    invoiceNo: inv.taxInvoiceNo,
                    paymentId: t.supplierPayment.id,
                });
            }
            if (t.vatPayment) base.vatPaymentId = t.vatPayment.id;
            if (t.debitAccountId && out[t.debitAccountId]) {
                out[t.debitAccountId].push({ id: t.id, data: { ...base, type: "debit" } });
            }
            if (t.creditAccountId && out[t.creditAccountId]) {
                out[t.creditAccountId].push({ id: t.id, data: { ...base, type: "credit" } });
            }
        }
        return out;
    }

    // ── Clients & invoices ──────────────────────────────────────────────

    private async clients(companyId: string, id?: string): Promise<Doc[]> {
        const rows = await this.prisma.client.findMany({
            where: { companyId, ...(id ? { id } : {}) },
            orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({
            id: r.id,
            data: {
                name: r.name,
                address: r.address,
                vatNo: r.vatNo,
                contactNo: r.contactNo,
                status: r.status,
                entityStatus: r.entityStatus,
                createdAt: iso(r.createdAt),
                updatedAt: iso(r.updatedAt),
            },
        }));
    }

    private async invoices(companyId: string, clientId: string, id?: string): Promise<Doc[]> {
        const rows = await this.prisma.invoice.findMany({
            where: { companyId, clientId, ...(id ? { id } : {}) },
            include: { lineItems: { orderBy: { position: "asc" } } },
            orderBy: { date: "desc" },
        });
        return rows.map((r) => ({
            id: r.id,
            data: {
                taxInvoiceNo: r.taxInvoiceNo,
                date: iso(r.date),
                delivery: { date: iso(r.deliveryDate), address: r.deliveryAddress, reference: r.deliveryReference },
                client: r.clientSnapshot,
                template: r.templateSnapshot,
                lineItems: r.lineItems.map((l) => ({
                    no: l.position,
                    date: iso(l.date),
                    vehicleNo: l.vehicleNo,
                    rate: num(l.rate),
                    amount: num(l.amount),
                    customValues: l.customValues,
                })),
                totalAmount: num(r.totalAmount),
                vatAmount: num(r.vatAmount),
                totalIncludingVat: num(r.totalIncludingVat),
                outstandingAmount: num(r.outstandingAmount),
                status: r.status,
                isActive: r.status !== "paid" && r.status !== "cancelled",
                entityStatus: r.entityStatus,
                createdAt: iso(r.createdAt),
                createdBy: r.createdById,
                updatedAt: iso(r.updatedAt),
                updatedBy: r.updatedById,
            },
        }));
    }

    private async invoicePayments(companyId: string, clientId: string, invoiceId: string): Promise<Doc[]> {
        const rows = await this.prisma.invoicePayment.findMany({
            where: { invoiceId, invoice: { companyId, clientId } },
            include: { transaction: { include: { debitAccount: true, creditAccount: true } } },
            orderBy: { date: "desc" },
        });
        return rows.map((r) => ({ id: r.id, data: this.paymentData(r) }));
    }

    private async templates(companyId: string, clientId: string): Promise<Doc[]> {
        const t = await this.prisma.invoiceTemplate.findFirst({ where: { clientId, client: { companyId } } });
        if (!t) return [];
        return [
            {
                id: "config",
                data: {
                    clientId: t.clientId,
                    columns: t.columns,
                    signing: t.signing,
                    supplier: t.supplier,
                    entityStatus: t.entityStatus,
                    createdAt: iso(t.createdAt),
                    createdBy: t.createdById,
                    updatedAt: iso(t.updatedAt),
                    updatedBy: t.updatedById,
                },
            },
        ];
    }

    // ── Suppliers ───────────────────────────────────────────────────────

    private async suppliers(companyId: string, id?: string): Promise<Doc[]> {
        const rows = await this.prisma.supplier.findMany({
            where: { companyId, ...(id ? { id } : {}) },
            include: { supplierType: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({
            id: r.id,
            data: {
                name: r.name,
                tin: r.tin,
                address: r.address,
                supplierType: r.supplierType?.name ?? "",
                contactNo: r.contactNo,
                status: r.status,
                entityStatus: r.entityStatus,
                createdAt: iso(r.createdAt),
            },
        }));
    }

    private async supplierInvoices(companyId: string, supplierId: string, id?: string): Promise<Doc[]> {
        const rows = await this.prisma.supplierInvoice.findMany({
            where: { companyId, supplierId, ...(id ? { id } : {}) },
            include: { lines: { orderBy: { position: "asc" } } },
            orderBy: { date: "desc" },
        });
        return rows.map((r) => ({
            id: r.id,
            data: {
                taxInvoiceNo: r.taxInvoiceNo,
                date: iso(r.date),
                totalIncludingVat: num(r.totalIncludingVat),
                billAmount: num(r.billAmount),
                vatAmount: num(r.vatAmount),
                lineItems: r.lines.map((l) => ({ id: l.id, description: l.description, quantity: l.quantity })),
                outstandingAmount: num(r.outstandingAmount),
                status: r.status,
                entityStatus: r.entityStatus,
                createdAt: iso(r.createdAt),
                createdBy: r.createdById,
            },
        }));
    }

    private async supplierPayments(companyId: string, supplierId: string, invoiceId: string): Promise<Doc[]> {
        const rows = await this.prisma.supplierPayment.findMany({
            where: { supplierInvoiceId: invoiceId, supplierInvoice: { companyId, supplierId } },
            include: { transaction: { include: { debitAccount: true, creditAccount: true } } },
            orderBy: { date: "desc" },
        });
        return rows.map((r) => ({ id: r.id, data: this.paymentData(r) }));
    }

    /** Payments no longer store account IDs/names; they come from the payment's ledger entry. */
    private paymentData(r: {
        date: Date;
        description: string;
        chequeNo: string;
        amount: unknown;
        transactionId: string | null;
        entityStatus: boolean;
        createdAt: Date;
        createdById: string | null;
        transaction: {
            debitAccount: { id: string; name: string } | null;
            creditAccount: { id: string; name: string } | null;
        } | null;
    }): DocData {
        return {
            date: iso(r.date),
            description: r.description,
            chequeNo: r.chequeNo,
            amount: num(r.amount),
            creditingAccountId: r.transaction?.creditAccount?.id ?? "",
            creditingAccountName: r.transaction?.creditAccount?.name ?? "",
            debitingAccountId: r.transaction?.debitAccount?.id ?? "",
            debitingAccountName: r.transaction?.debitAccount?.name ?? "",
            transactionId: r.transactionId ?? "",
            entityStatus: r.entityStatus,
            createdAt: iso(r.createdAt),
            createdBy: r.createdById,
        };
    }

    // ── VAT, reports, inventory ─────────────────────────────────────────

    private async vatPayments(companyId: string): Promise<Doc[]> {
        const rows = await this.prisma.vatPayment.findMany({
            where: { companyId },
            include: { account: { select: { name: true } } },
            orderBy: { date: "desc" },
        });
        return rows.map((r) => ({
            id: r.id,
            data: {
                quarterKey: r.quarterKey,
                quarterLabel: quarterLabel(r.quarterKey),
                date: iso(r.date),
                amount: num(r.amount),
                reference: r.reference,
                accountId: r.accountId,
                accountName: r.account.name,
                transactionId: r.transactionId ?? "",
                entityStatus: r.entityStatus,
                createdAt: iso(r.createdAt),
                createdBy: r.createdById,
            },
        }));
    }

    private async reports(companyId: string, id?: string): Promise<Doc[]> {
        const rows = await this.prisma.report.findMany({
            where: { companyId, ...(id ? { id } : {}) },
            include: { accounts: { select: { accountId: true } } },
            orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({
            id: r.id,
            data: {
                name: r.name,
                description: r.description,
                fromDate: iso(r.fromDate),
                toDate: iso(r.toDate),
                accountIds: r.accounts.map((a) => a.accountId),
                ...(r.filters ? { filters: r.filters } : {}),
                createdBy: r.createdById,
                entityStatus: r.entityStatus,
                createdAt: iso(r.createdAt),
            },
        }));
    }

    private async spareParts(companyId: string): Promise<Doc[]> {
        const rows = await this.prisma.sparePart.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
        return rows.map((r) => ({
            id: r.id,
            data: {
                partId: r.partId,
                partIdKey: r.partIdKey,
                description: r.description,
                status: r.status,
                vehicleId: r.vehicleId,
                assignedAt: iso(r.assignedAt),
                entityStatus: r.entityStatus,
                createdAt: iso(r.createdAt),
            },
        }));
    }
}
