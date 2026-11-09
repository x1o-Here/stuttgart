import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CompanyDto, CompanyInput } from "@stuttgart/shared/schemas/identity";
import type { Company } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { audit } from "../audit/audit.js";
import type { AuthUser } from "../auth/index.js";

const toDto = (c: Company): CompanyDto => ({
    id: c.id,
    name: c.name,
    address: c.address,
    telephoneNo: c.telephoneNo,
    tin: c.tin,
    entityStatus: c.entityStatus,
});

@Injectable()
export class CompaniesService {
    constructor(private readonly prisma: PrismaService) {}

    async get(companyId: string): Promise<CompanyDto> {
        const company = await this.prisma.company.findUnique({ where: { id: companyId } });
        if (!company) throw new NotFoundException();
        return toDto(company);
    }

    /** Admins see every company; others see the companies they belong to (active or not). */
    async list(user: AuthUser): Promise<CompanyDto[]> {
        const companies = await this.prisma.company.findMany({
            where: user.role === "admin" ? {} : { users: { some: { userId: user.uid } } },
            orderBy: { name: "asc" },
        });
        return companies.map(toDto);
    }

    /** Active companies, for the "assign companies" picker when adding a user. */
    async options(): Promise<{ id: string; name: string }[]> {
        return this.prisma.company.findMany({
            where: { entityStatus: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        });
    }

    /** Was company-form-dialog (create): the company, the creator's membership and an audit entry. */
    create(user: AuthUser, input: CompanyInput): Promise<CompanyDto> {
        return this.prisma.$transaction(async (tx) => {
            const company = await tx.company.create({ data: this.fields(input) });
            await tx.userCompany.create({ data: { userId: user.uid, companyId: company.id } });
            await audit(tx, {
                userId: user.uid,
                companyId: company.id,
                action: "create",
                description: `Company created: ${company.name}`,
                entityId: company.id,
            });
            return toDto(company);
        });
    }

    update(user: AuthUser, companyId: string, input: CompanyInput): Promise<CompanyDto> {
        return this.prisma.$transaction(async (tx) => {
            await this.assertCanManage(user, companyId);
            const company = await tx.company.update({
                where: { id: companyId },
                data: { ...this.fields(input), updatedById: user.uid },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "update",
                description: `Company updated: ${company.name}`,
                entityId: companyId,
            });
            return toDto(company);
        });
    }

    /** Was company-actions (activate / deactivate). */
    setActive(user: AuthUser, companyId: string, active: boolean): Promise<CompanyDto> {
        return this.prisma.$transaction(async (tx) => {
            await this.assertCanManage(user, companyId);
            const company = await tx.company.update({
                where: { id: companyId },
                data: { entityStatus: active, updatedById: user.uid },
            });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "update",
                description: `Company ${active ? "activated" : "deactivated"}: ${company.name}`,
                entityId: companyId,
            });
            return toDto(company);
        });
    }

    // ── helpers ──────────────────────────────────────────────────────────

    /** Admins manage any company; managers only companies they belong to (even inactive ones). */
    private async assertCanManage(user: AuthUser, companyId: string) {
        const company = await this.prisma.company.findUnique({ where: { id: companyId } });
        if (!company) throw new NotFoundException("Company not found");
        if (user.role === "admin") return;
        const member = await this.prisma.userCompany.findUnique({
            where: { userId_companyId: { userId: user.uid, companyId } },
        });
        if (!member) throw new ForbiddenException("No access to this company");
    }

    private fields(input: CompanyInput) {
        return {
            name: input.name.trim(),
            address: (input.address ?? "").trim(),
            telephoneNo: (input.telephoneNo ?? "").trim(),
            tin: (input.tin ?? "").trim(),
        };
    }
}
