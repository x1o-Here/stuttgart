import { Injectable, NotFoundException } from "@nestjs/common";
import {
    CLIENT_ACCOUNT_TYPE_NAME,
    CLIENT_ACCOUNT_TYPE_SHORT_FORM,
} from "@stuttgart/shared/constants/client-account";
import type { ClientDto, ClientInput, ClientStatus } from "@stuttgart/shared/schemas/clients";
import type { Client } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { audit, type Tx } from "../audit/audit.js";
import type { AuthUser } from "../auth/index.js";

type InvoiceStats = { activeInvoiceCount: number; outstandingInvoiceAmount: number };
const NO_INVOICES: InvoiceStats = { activeInvoiceCount: 0, outstandingInvoiceAmount: 0 };

@Injectable()
export class ClientsService {
    constructor(private readonly prisma: PrismaService) {}

    async list(companyId: string): Promise<ClientDto[]> {
        const [clients, stats] = await Promise.all([
            this.prisma.client.findMany({
                where: { companyId, entityStatus: true },
                orderBy: { createdAt: "desc" },
            }),
            this.invoiceStats(companyId),
        ]);
        return clients.map((client) => toDto(client, stats.get(client.id)));
    }

    async get(companyId: string, id: string): Promise<ClientDto> {
        const client = await this.findOrThrow(this.prisma, companyId, id);
        const stats = await this.invoiceStats(companyId, id);
        return toDto(client, stats.get(id));
    }

    /**
     * Was the writeBatch in add-client-dialog.tsx: the client, the system
     * "Client" account type (if missing), the client's ledger account and two
     * audit entries. All of it is saved, or none of it.
     */
    create(companyId: string, user: AuthUser, input: ClientInput): Promise<ClientDto> {
        return this.prisma.$transaction(async (tx) => {
            const client = await tx.client.create({ data: { companyId, ...input } });
            const accountTypeId = await this.clientAccountTypeId(tx, companyId);
            const account = await tx.account.create({
                data: { companyId, name: client.name, accountTypeId, clientId: client.id },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "create",
                description: `Client created: ${client.name}`,
                entityId: client.id,
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "create",
                description: `Client account created: ${client.name}`,
                entityId: account.id,
            });
            return toDto(client);
        });
    }

    /** Was edit-client-dialog.tsx. Renaming the client also renames its account. */
    update(companyId: string, user: AuthUser, id: string, input: ClientInput): Promise<ClientDto> {
        return this.prisma.$transaction(async (tx) => {
            const before = await this.findOrThrow(tx, companyId, id);
            const client = await tx.client.update({ where: { id }, data: input });
            if (client.name !== before.name) {
                await tx.account.updateMany({ where: { companyId, clientId: id }, data: { name: client.name } });
            }
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "update",
                description: `Client updated: ${client.name}`,
                entityId: id,
            });
            return toDto(client);
        });
    }

    /** Was change-client-status-dialog.tsx. */
    setStatus(companyId: string, user: AuthUser, id: string, status: ClientStatus): Promise<ClientDto> {
        return this.prisma.$transaction(async (tx) => {
            await this.findOrThrow(tx, companyId, id);
            const client = await tx.client.update({ where: { id }, data: { status } });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "update",
                description: `Client status changed to ${status}: ${client.name}`,
                entityId: id,
            });
            return toDto(client);
        });
    }

    // ── helpers ──────────────────────────────────────────────────────────

    /** Always look clients up by company as well as ID, so another company's ID can't be used. */
    private async findOrThrow(db: Tx | PrismaService, companyId: string, id: string) {
        const client = await db.client.findFirst({ where: { id, companyId, entityStatus: true } });
        if (!client) throw new NotFoundException("Client not found");
        return client;
    }

    /** The company's "Client" account type, created (or marked as system) if needed. */
    private async clientAccountTypeId(tx: Tx, companyId: string): Promise<string> {
        const existing = await tx.accountType.findFirst({
            where: { companyId, name: { equals: CLIENT_ACCOUNT_TYPE_NAME, mode: "insensitive" } },
        });
        if (existing) {
            if (!existing.isSystem) await tx.accountType.update({ where: { id: existing.id }, data: { isSystem: true } });
            return existing.id;
        }
        const created = await tx.accountType.create({
            data: {
                companyId,
                name: CLIENT_ACCOUNT_TYPE_NAME,
                shortForm: CLIENT_ACCOUNT_TYPE_SHORT_FORM,
                isSystem: true,
            },
        });
        return created.id;
    }

    /** Open (not paid / cancelled) invoices per client, summed in SQL. */
    private async invoiceStats(companyId: string, clientId?: string): Promise<Map<string, InvoiceStats>> {
        const rows = await this.prisma.invoice.groupBy({
            by: ["clientId"],
            where: {
                companyId,
                ...(clientId ? { clientId } : {}),
                entityStatus: true,
                status: { notIn: ["paid", "cancelled"] },
            },
            _count: { _all: true },
            _sum: { outstandingAmount: true },
        });
        return new Map(
            rows.map((row) => [
                row.clientId,
                {
                    activeInvoiceCount: row._count._all,
                    outstandingInvoiceAmount: Number(row._sum.outstandingAmount ?? 0),
                },
            ]),
        );
    }
}

function toDto(client: Client, stats: InvoiceStats = NO_INVOICES): ClientDto {
    return {
        id: client.id,
        name: client.name,
        address: client.address,
        vatNo: client.vatNo,
        contactNo: client.contactNo,
        status: client.status,
        ...stats,
        createdAt: client.createdAt.toISOString(),
    };
}
