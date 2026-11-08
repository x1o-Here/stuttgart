import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
    sparePartAssignSchema as assignSchema,
    sparePartInputSchema as partSchema,
    sparePartReleaseSchema as releaseSchema,
} from "@stuttgart/shared/schemas/inventory";
import type { z } from "zod";
import { type AuthUser, CompanyAccessGuard, CurrentUser } from "../auth/index.js";
import { InventoryService } from "./inventory.service.js";

/** Spare parts (Inventory page, Fleet → vehicle page). */
@Controller("companies/:companyId")
@UseGuards(CompanyAccessGuard)
export class InventoryController {
    constructor(private readonly inventory: InventoryService) {}

    @Post("spare-parts")
    create(
        @Param("companyId") companyId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: partSchema }) body: z.output<typeof partSchema>,
    ) {
        return this.inventory.create(companyId, user, body);
    }

    @Patch("spare-parts/:id")
    update(
        @Param("companyId") companyId: string,
        @Param("id") id: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: partSchema }) body: z.output<typeof partSchema>,
    ) {
        return this.inventory.update(companyId, user, id, body);
    }

    @Delete("spare-parts/:id")
    remove(@Param("companyId") companyId: string, @Param("id") id: string, @CurrentUser() user: AuthUser) {
        return this.inventory.remove(companyId, user, id);
    }

    @Post("spare-parts/:id/assign")
    assign(
        @Param("companyId") companyId: string,
        @Param("id") id: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: assignSchema }) body: z.output<typeof assignSchema>,
    ) {
        return this.inventory.assign(companyId, user, id, body.vehicleId);
    }

    @Post("spare-parts/:id/release")
    release(
        @Param("companyId") companyId: string,
        @Param("id") id: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: releaseSchema }) body: z.output<typeof releaseSchema>,
    ) {
        return this.inventory.release(companyId, user, id, body.mode);
    }

    @Post("vehicles/:vehicleId/release-parts")
    releaseAll(
        @Param("companyId") companyId: string,
        @Param("vehicleId") vehicleId: string,
        @CurrentUser() user: AuthUser,
    ) {
        return this.inventory.releaseAllForVehicle(companyId, user, vehicleId);
    }
}
