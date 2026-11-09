import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
    type CompanyInput,
    companyInputSchema,
    type CompanyStatusInput,
    companyStatusSchema,
} from "@stuttgart/shared/schemas/identity";
import { type AuthUser, CompanyAccessGuard, CurrentUser, Roles } from "../auth/index.js";
import { CompaniesService } from "./companies.service.js";

/** Company administration (Users page → Companies tab). */
@Controller("companies")
export class CompaniesController {
    constructor(private readonly companies: CompaniesService) {}

    @Get()
    @Roles("admin", "manager")
    list(@CurrentUser() user: AuthUser) {
        return this.companies.list(user);
    }

    @Get("options")
    @Roles("admin", "manager")
    options() {
        return this.companies.options();
    }

    @Post()
    @Roles("admin", "manager")
    create(@CurrentUser() user: AuthUser, @Body({ schema: companyInputSchema }) body: CompanyInput) {
        return this.companies.create(user, body);
    }

    @Patch(":companyId")
    @Roles("admin", "manager")
    update(
        @CurrentUser() user: AuthUser,
        @Param("companyId") companyId: string,
        @Body({ schema: companyInputSchema }) body: CompanyInput,
    ) {
        return this.companies.update(user, companyId, body);
    }

    @Patch(":companyId/status")
    @Roles("admin", "manager")
    setStatus(
        @CurrentUser() user: AuthUser,
        @Param("companyId") companyId: string,
        @Body({ schema: companyStatusSchema }) body: CompanyStatusInput,
    ) {
        return this.companies.setActive(user, companyId, body.active);
    }

    /** Any member: the company's own details. */
    @Get(":companyId")
    @UseGuards(CompanyAccessGuard)
    get(@Param("companyId") companyId: string) {
        return this.companies.get(companyId);
    }
}
