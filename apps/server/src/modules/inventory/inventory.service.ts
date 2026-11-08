import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { audit, type Tx } from "../audit/audit.js";
import type { AuthUser } from "../auth/index.js";

/** Same normalisation as lib/inventory/spare-parts.ts (partIdKey). */
const partIdKey = (partId: string) => partId.trim().toLowerCase();

@Injectable()
export class InventoryService {
    constructor(private readonly prisma: PrismaService) {}

    async create(companyId: string, user: AuthUser, input: { partId: string; description: string }) {
        const partId = input.partId.trim();
        const key = partIdKey(partId);
        if (!key) throw new BadRequestException("Part ID is required.");
        return this.uniquePartId(partId, () =>
            this.prisma.$transaction(async (tx) => {
                const part = await tx.sparePart.create({
                    data: {
                        companyId,
                        partId,
                        partIdKey: key,
                        description: input.description.trim(),
                        status: "in_stock",
                        createdById: user.uid,
                    },
                });
                await audit(tx, {
                    userId: user.uid,
                    companyId,
                    action: "create",
                    description: `Spare part ${partId} added to stock`,
                    entityId: part.id,
                });
                return { id: part.id };
            }),
        );
    }

    async update(companyId: string, user: AuthUser, id: string, input: { partId: string; description: string }) {
        const partId = input.partId.trim();
        const key = partIdKey(partId);
        if (!key) throw new BadRequestException("Part ID is required.");
        return this.uniquePartId(partId, () =>
            this.prisma.$transaction(async (tx) => {
                await this.part(tx, companyId, id);
                await tx.sparePart.update({
                    where: { id },
                    data: { partId, partIdKey: key, description: input.description.trim(), updatedById: user.uid },
                });
                await audit(tx, {
                    userId: user.uid,
                    companyId,
                    action: "update",
                    description: `Spare part ${partId} updated`,
                    entityId: id,
                });
            }),
        );
    }

    /** Soft delete; frees the part ID. Parts on a vehicle must be removed first. */
    remove(companyId: string, user: AuthUser, id: string) {
        return this.prisma.$transaction(async (tx) => {
            const part = await tx.sparePart.findFirst({ where: { id, companyId, entityStatus: true } });
            if (!part) return;
            if (part.status === "assigned") {
                throw new BadRequestException("Remove this part from its vehicle before deleting it.");
            }
            await tx.sparePart.update({ where: { id }, data: { entityStatus: false, updatedById: user.uid } });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "delete",
                description: `Spare part ${part.partId} deleted`,
                entityId: id,
            });
        });
    }

    assign(companyId: string, user: AuthUser, id: string, vehicleId: string) {
        return this.prisma.$transaction(async (tx) => {
            const part = await this.part(tx, companyId, id);
            if (part.status !== "in_stock") {
                throw new BadRequestException("This part was just assigned or scrapped by someone else.");
            }
            const vehicle = await tx.vehicle.findFirst({ where: { id: vehicleId, companyId, entityStatus: true } });
            if (!vehicle) throw new BadRequestException("This vehicle no longer exists.");
            await tx.sparePart.update({
                where: { id },
                data: { status: "assigned", vehicleId, assignedAt: new Date(), updatedById: user.uid },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "update",
                description: `Spare part ${part.partId} assigned to ${vehicle.name}`,
                entityId: id,
            });
        });
    }

    /** Takes a part off its vehicle, back to stock or scrapped. */
    release(companyId: string, user: AuthUser, id: string, mode: "stock" | "scrapped") {
        return this.prisma.$transaction(async (tx) => {
            const part = await this.part(tx, companyId, id);
            if (part.status !== "assigned") throw new BadRequestException("This part is no longer on a vehicle.");
            const vehicle = part.vehicleId ? await tx.vehicle.findUnique({ where: { id: part.vehicleId } }) : null;
            await tx.sparePart.update({
                where: { id },
                data: {
                    status: mode === "stock" ? "in_stock" : "scrapped",
                    vehicleId: null,
                    assignedAt: null,
                    updatedById: user.uid,
                },
            });
            const from = vehicle?.name ?? "its vehicle";
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "update",
                description:
                    mode === "stock"
                        ? `Spare part ${part.partId} removed from ${from} and returned to stock`
                        : `Spare part ${part.partId} removed from ${from} and scrapped`,
                entityId: id,
            });
        });
    }

    /** Returns every part on a vehicle to stock (used before deleting the vehicle). */
    releaseAllForVehicle(companyId: string, user: AuthUser, vehicleId: string) {
        return this.prisma.$transaction(async (tx) => {
            const vehicle = await tx.vehicle.findFirst({ where: { id: vehicleId, companyId } });
            if (!vehicle) throw new BadRequestException("This vehicle no longer exists.");
            const { count } = await tx.sparePart.updateMany({
                where: { companyId, vehicleId, status: "assigned", entityStatus: true },
                data: { status: "in_stock", vehicleId: null, assignedAt: null, updatedById: user.uid },
            });
            if (count > 0) {
                await audit(tx, {
                    userId: user.uid,
                    companyId,
                    action: "update",
                    description: `${count} spare part${count === 1 ? "" : "s"} returned to stock from ${vehicle.name}`,
                    entityId: vehicleId,
                });
            }
            return { count };
        });
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private async part(tx: Tx, companyId: string, id: string) {
        const part = await tx.sparePart.findFirst({ where: { id, companyId, entityStatus: true } });
        if (!part) throw new BadRequestException("This part no longer exists.");
        return part;
    }

    /** The partial unique index replaces the sparePartIds claim docs. */
    private async uniquePartId<T>(partId: string, work: () => Promise<T>): Promise<T> {
        try {
            return await work();
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                throw new BadRequestException(`Part ID ${partId} is already in inventory.`);
            }
            throw error;
        }
    }
}
