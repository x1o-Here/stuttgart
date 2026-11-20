import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
    EMPLOYEE_ACCOUNT_TYPE_NAME,
    EMPLOYEE_ACCOUNT_TYPE_SHORT_FORM,
    EPF_ACCOUNT_NAME,
    ETF_ACCOUNT_NAME,
    employeeAccountName,
} from "@stuttgart/shared/constants/client-account";
import type { EmployeeDto, EmployeeInput } from "@stuttgart/shared/schemas/employees";
import { type Employee, Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { audit, type Tx } from "../audit/audit.js";
import type { AuthUser } from "../auth/index.js";
import { systemAccountTypeId } from "../ledger/party-postings.js";

@Injectable()
export class EmployeesService {
    constructor(private readonly prisma: PrismaService) {}

    async list(companyId: string): Promise<EmployeeDto[]> {
        const rows = await this.prisma.employee.findMany({
            where: { companyId, entityStatus: true },
            include: { account: { select: { id: true } } },
            orderBy: { createdAt: "desc" },
        });
        return rows.map((row) => toDto(row, row.account?.id));
    }

    /**
     * The employee, their "EMP_<name>" account under the system Employee type,
     * the company's EPF and ETF accounts (once per company) and the audit
     * entries. All of it is saved, or none of it.
     */
    create(companyId: string, user: AuthUser, input: EmployeeInput): Promise<EmployeeDto> {
        return this.uniqueEmployeeNo(input.employeeNo, () =>
            this.prisma.$transaction(async (tx) => {
                const employee = await tx.employee.create({
                    data: { companyId, ...input, createdById: user.uid },
                });
                const accountTypeId = await systemAccountTypeId(
                    tx,
                    companyId,
                    EMPLOYEE_ACCOUNT_TYPE_NAME,
                    EMPLOYEE_ACCOUNT_TYPE_SHORT_FORM,
                );
                const account = await tx.account.create({
                    data: { companyId, name: employeeAccountName(employee.name), accountTypeId, employeeId: employee.id },
                });
                await audit(tx, {
                    userId: user.uid,
                    companyId,
                    action: "create",
                    description: `Employee created: ${employee.employeeNo} ${employee.name}`,
                    entityId: employee.id,
                });
                await audit(tx, {
                    userId: user.uid,
                    companyId,
                    action: "create",
                    description: `Employee account created: ${account.name}`,
                    entityId: account.id,
                });
                await this.ensureStatutoryAccounts(tx, companyId, accountTypeId, user);
                return toDto(employee, account.id);
            }),
        );
    }

    /** Renaming the employee also renames their account. */
    update(companyId: string, user: AuthUser, id: string, input: EmployeeInput): Promise<EmployeeDto> {
        return this.uniqueEmployeeNo(input.employeeNo, () =>
            this.prisma.$transaction(async (tx) => {
                const before = await this.findOrThrow(tx, companyId, id);
                const employee = await tx.employee.update({
                    where: { id },
                    data: { ...input, updatedById: user.uid },
                    include: { account: { select: { id: true } } },
                });
                if (employee.name !== before.name) {
                    await tx.account.updateMany({
                        where: { companyId, employeeId: id },
                        data: { name: employeeAccountName(employee.name) },
                    });
                }
                await audit(tx, {
                    userId: user.uid,
                    companyId,
                    action: "update",
                    description: `Employee updated: ${employee.employeeNo} ${employee.name}`,
                    entityId: id,
                });
                return toDto(employee, employee.account?.id);
            }),
        );
    }

    // ── helpers ──────────────────────────────────────────────────────────

    /** Always look employees up by company as well as ID, so another company's ID can't be used. */
    private async findOrThrow(db: Tx | PrismaService, companyId: string, id: string) {
        const employee = await db.employee.findFirst({ where: { id, companyId, entityStatus: true } });
        if (!employee) throw new NotFoundException("Employee not found");
        return employee;
    }

    /**
     * The company has exactly one EPF and one ETF account, shared by all
     * employees. They are created with the first employee; an existing live
     * account with the same name (any type) is reused. A per-company lock
     * keeps two employees added at the same time from creating them twice.
     */
    private async ensureStatutoryAccounts(tx: Tx, companyId: string, accountTypeId: string, user: AuthUser) {
        await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${`statutory-accounts:${companyId}`}))) AS l`;
        for (const name of [EPF_ACCOUNT_NAME, ETF_ACCOUNT_NAME]) {
            const existing = await tx.account.findFirst({
                where: {
                    companyId,
                    entityStatus: true,
                    name: { equals: name, mode: "insensitive" },
                    clientId: null,
                    supplierId: null,
                    vehicleId: null,
                    employeeId: null,
                },
                select: { id: true },
            });
            if (existing) continue;
            const account = await tx.account.create({ data: { companyId, name, accountTypeId } });
            await audit(tx, {
                userId: user.uid,
                companyId,
                action: "create",
                description: `${name} account created`,
                entityId: account.id,
            });
        }
    }

    /** The partial unique index keeps employee numbers unique per company among live employees. */
    private async uniqueEmployeeNo<T>(employeeNo: string, work: () => Promise<T>): Promise<T> {
        try {
            return await work();
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                throw new ConflictException(`Employee number ${employeeNo} is already in use.`);
            }
            throw error;
        }
    }
}

function toDto(employee: Employee, accountId?: string | null): EmployeeDto {
    return {
        id: employee.id,
        employeeNo: employee.employeeNo,
        name: employee.name,
        role: employee.role,
        accountId: accountId ?? null,
        createdAt: employee.createdAt.toISOString(),
    };
}
