import { Controller, Get, NotFoundException, Param, UseGuards } from "@nestjs/common";
import { CompanyAccessGuard } from "../auth/index.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";

@Controller("companies/:companyId")
@UseGuards(CompanyAccessGuard)
export class CompaniesController {
    constructor(private readonly prisma: PrismaService) { }

    @Get()
    async get(@Param("companyId") companyId: string) {
        const company = await this.prisma.company.findUnique({ where: { id: companyId } });
        if (!company) throw new NotFoundException();
        return company;
    }
}