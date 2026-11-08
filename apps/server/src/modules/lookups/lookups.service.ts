import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
    isProtectedAccountType,
    isSystemAccountTypeName,
} from "@stuttgart/shared/constants/client-account";
import type {
    LookupInput,
    LookupItemDto,
    LookupKind,
    LookupsDto,
    LookupUpdate,
} from "@stuttgart/shared/schemas/lookups";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { audit, type Tx } from "../audit/audit.js";
import type { AuthUser } from "../auth/index.js";

const LABEL: Record<LookupKind, string> = {
    "account-types": "Account type",
    departments: "Department",
    "supplier-types": "Supplier type",
    vehicles: "Vehicle",
};

/** The columns the four lookup tables share. */
type LookupRow = {
    id: string;
    companyId: string;
    name: string;
    shortForm: string;
    entityStatus: boolean;
    createdAt: Date;
    isSystem?: boolean;
    description?: string;
};

/**
 * The four lookup tables have the same shape, but Prisma gives each its own
 * delegate type. This narrow interface lets one service drive all four.
 */
type LookupDelegate = {
    findMany(args: object): Promise<LookupRow[]>;
    findFirst(args: object): Promise<LookupRow | null>;
    create(args: object): Promise<LookupRow>;
    update(args: object): Promise<LookupRow>;
    delete(args: object): Promise<LookupRow>;
};

function table(db: Tx | PrismaService, kind: LookupKind): LookupDelegate {
    const delegates = {
        "account-types": db.accountType,
        departments: db.department,
        "supplier-types": db.supplierType,
        vehicles: db.vehicle,
    };
    return delegates[kind] as unknown as LookupDelegate;
}

function toDto(row: LookupRow): LookupItemDto {
    return {
        id: row.id,
        name: row.name,
        shortForm: row.shortForm,
        description: row.description ?? "",
        isSystem: row.isSystem ?? false,
        entityStatus: row.entityStatus,
        createdAt: row.createdAt.toISOString(),
    };
}

@Injectable()
export class LookupsService {
    constructor(private readonly prisma: PrismaService) {}

    async all(companyId: string): Promise<LookupsDto> {
        const list = (kind: LookupKind) =>
            table(this.prisma, kind)
                .findMany({ where: { companyId, entityStatus: true }, orderBy: { createdAt: "desc" } })
                .then((rows) => rows.map(toDto));
        const [accountTypes, departments, supplierTypes, vehicles] = await Promise.all([
            list("account-types"),
            list("departments"),
            list("supplier-types"),
            list("vehicles"),
        ]);
        return { accountTypes, departments, supplierTypes, vehicles };
    }

    create(companyId: string, user: AuthUser, kind: LookupKind, input: LookupInput): Promise<LookupItemDto> {
        const name = input.name.trim();
        if (kind === "account-types" && isSystemAccountTypeName(name)) {
            throw new BadRequestException(
                `The "${name}" account type is system-managed and cannot be created manually.`,
            );
        }
        const data = this.fields(kind, input);
        return this.prisma.$transaction(async (tx) => {
            // A previously deleted item with the same name is brought back instead of duplicated.
            const existing = await table(tx, kind).findFirst({ where: { companyId, name } });
            if (existing?.entityStatus) throw new BadRequestException(`${LABEL[kind]} "${name}" already exists.`);
            const row = existing
                ? await table(tx, kind).update({ where: { id: existing.id }, data: { ...data, entityStatus: true } })
                : await table(tx, kind).create({ data: { companyId, ...data } });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "create",
                description: `${LABEL[kind]} created: ${name}`,
                entityId: row.id,
            });
            return toDto(row);
        });
    }

    update(
        companyId: string,
        user: AuthUser,
        kind: LookupKind,
        id: string,
        input: LookupUpdate,
    ): Promise<LookupItemDto> {
        return this.prisma.$transaction(async (tx) => {
            const existing = await this.findOrThrow(tx, companyId, kind, id);
            if (kind === "account-types") {
                if (isProtectedAccountType(existing)) {
                    throw new BadRequestException(`The "${existing.name}" account type cannot be edited.`);
                }
                if (input.name && isSystemAccountTypeName(input.name)) {
                    throw new BadRequestException(`Cannot rename an account type to "${input.name}".`);
                }
            }
            const data = this.fields(kind, input);
            let row: LookupRow;
            try {
                row = await table(tx, kind).update({ where: { id }, data });
            } catch (error) {
                throw this.duplicateName(error, kind, input.name) ?? error;
            }
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "update",
                description: `${LABEL[kind]} updated: ${input.name ?? id}`,
                entityId: id,
            });
            return toDto(row);
        });
    }

    /**
     * Firestore deleted lookup items outright. In Postgres an item that is
     * still referenced (e.g. a department used by transactions) can't be
     * removed, so it is hidden instead (entityStatus = false).
     */
    async remove(companyId: string, user: AuthUser, kind: LookupKind, id: string): Promise<void> {
        const existing = await this.findOrThrow(this.prisma, companyId, kind, id);
        if (kind === "account-types" && isProtectedAccountType(existing)) {
            throw new BadRequestException(`The "${existing.name}" account type cannot be deleted.`);
        }
        const auditEntry = {
            userId: user.uid,
            companyId,
            action: "delete",
            description: `${LABEL[kind]} deleted: ${existing.name}`,
            entityId: id,
        };
        try {
            await this.prisma.$transaction(async (tx) => {
                await table(tx, kind).delete({ where: { id } });
                await audit(tx, auditEntry);
            });
        } catch (error) {
            const inUse = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
            if (!inUse) throw error;
            await this.prisma.$transaction(async (tx) => {
                await table(tx, kind).update({ where: { id }, data: { entityStatus: false } });
                await audit(tx, auditEntry);
            });
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private async findOrThrow(db: Tx | PrismaService, companyId: string, kind: LookupKind, id: string) {
        const row = await table(db, kind).findFirst({ where: { id, companyId, entityStatus: true } });
        if (!row) throw new NotFoundException(`${LABEL[kind]} not found`);
        return row;
    }

    /** Only vehicles have a description column. */
    private fields(kind: LookupKind, input: LookupUpdate) {
        const data: Record<string, string> = {};
        if (input.name !== undefined) data.name = input.name.trim();
        if (input.shortForm !== undefined) data.shortForm = input.shortForm.trim();
        if (kind === "vehicles" && input.description !== undefined) data.description = input.description.trim();
        return data;
    }

    private duplicateName(error: unknown, kind: LookupKind, name?: string) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return new BadRequestException(`${LABEL[kind]} "${name}" already exists.`);
        }
        return undefined;
    }
}
