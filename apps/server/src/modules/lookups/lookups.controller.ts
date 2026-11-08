import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
    type LookupInput,
    lookupInputSchema,
    type LookupKind,
    lookupKindSchema,
    type LookupUpdate,
    lookupUpdateSchema,
} from "@stuttgart/shared/schemas/lookups";
import { type AuthUser, CompanyAccessGuard, CurrentUser } from "../auth/index.js";
import { LookupsService } from "./lookups.service.js";

@Controller("companies/:companyId/lookups")
@UseGuards(CompanyAccessGuard)
export class LookupsController {
    constructor(private readonly lookups: LookupsService) {}

    @Get()
    all(@Param("companyId") companyId: string) {
        return this.lookups.all(companyId);
    }

    @Post(":kind")
    create(
        @Param("companyId") companyId: string,
        @Param("kind", { schema: lookupKindSchema }) kind: LookupKind,
        @CurrentUser() user: AuthUser,
        @Body({ schema: lookupInputSchema }) body: LookupInput,
    ) {
        return this.lookups.create(companyId, user, kind, body);
    }

    @Patch(":kind/:id")
    update(
        @Param("companyId") companyId: string,
        @Param("kind", { schema: lookupKindSchema }) kind: LookupKind,
        @Param("id") id: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: lookupUpdateSchema }) body: LookupUpdate,
    ) {
        return this.lookups.update(companyId, user, kind, id, body);
    }

    @Delete(":kind/:id")
    remove(
        @Param("companyId") companyId: string,
        @Param("kind", { schema: lookupKindSchema }) kind: LookupKind,
        @Param("id") id: string,
        @CurrentUser() user: AuthUser,
    ) {
        return this.lookups.remove(companyId, user, kind, id);
    }
}
