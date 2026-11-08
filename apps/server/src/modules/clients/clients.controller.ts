import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
    type ClientInput,
    clientInputSchema,
    type ClientStatusInput,
    clientStatusSchema,
} from "@stuttgart/shared/schemas/clients";
import { type AuthUser, CompanyAccessGuard, CurrentUser } from "../auth/index.js";
import { ClientsService } from "./clients.service.js";

@Controller("companies/:companyId/clients")
@UseGuards(CompanyAccessGuard)
export class ClientsController {
    constructor(private readonly clients: ClientsService) {}

    @Get()
    list(@Param("companyId") companyId: string) {
        return this.clients.list(companyId);
    }

    @Get(":id")
    get(@Param("companyId") companyId: string, @Param("id") id: string) {
        return this.clients.get(companyId, id);
    }

    @Post()
    create(
        @Param("companyId") companyId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: clientInputSchema }) body: ClientInput,
    ) {
        return this.clients.create(companyId, user, body);
    }

    @Patch(":id")
    update(
        @Param("companyId") companyId: string,
        @Param("id") id: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: clientInputSchema }) body: ClientInput,
    ) {
        return this.clients.update(companyId, user, id, body);
    }

    @Patch(":id/status")
    setStatus(
        @Param("companyId") companyId: string,
        @Param("id") id: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: clientStatusSchema }) body: ClientStatusInput,
    ) {
        return this.clients.setStatus(companyId, user, id, body.status);
    }
}
