import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { type EmployeeInput, employeeInputSchema } from "@stuttgart/shared/schemas/employees";
import { type AuthUser, CompanyAccessGuard, CurrentUser } from "../auth/index.js";
import { EmployeesService } from "./employees.service.js";

@Controller("companies/:companyId/employees")
@UseGuards(CompanyAccessGuard)
export class EmployeesController {
    constructor(private readonly employees: EmployeesService) {}

    @Get()
    list(@Param("companyId") companyId: string) {
        return this.employees.list(companyId);
    }

    @Post()
    create(
        @Param("companyId") companyId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: employeeInputSchema }) body: EmployeeInput,
    ) {
        return this.employees.create(companyId, user, body);
    }

    @Patch(":id")
    update(
        @Param("companyId") companyId: string,
        @Param("id") id: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: employeeInputSchema }) body: EmployeeInput,
    ) {
        return this.employees.update(companyId, user, id, body);
    }
}
