import { Controller, Get } from "@nestjs/common";
import type { AuditLogDto } from "@stuttgart/shared/schemas/identity";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { type AuthUser, CurrentUser, Roles } from "../auth/index.js";

/** Users page → Audit log tab. */
@Controller("audit-logs")
@Roles("admin", "manager")
export class AuditLogsController {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Admins see every entry. Managers see entries for their companies plus
     * entries that aren't about a company (user and profile changes).
     */
    @Get()
    async list(@CurrentUser() user: AuthUser): Promise<AuditLogDto[]> {
        const logs = await this.prisma.auditLog.findMany({
            where:
                user.role === "admin"
                    ? {}
                    : { OR: [{ companyId: null }, { companyId: { in: user.companyIds } }] },
            orderBy: { createdAt: "desc" },
            take: 10_000,
            include: {
                user: { select: { username: true, email: true, entityStatus: true } },
                company: { select: { name: true } },
            },
        });
        return logs.map((log) => {
            const name = log.user ? log.user.username || log.user.email || log.userId : "";
            return {
                id: log.id,
                action: log.action,
                description: log.description,
                companyId: log.companyId ?? "",
                companyName: log.company?.name ?? log.companyId ?? "",
                userId: log.userId ?? "",
                // Tell a removed account apart from a new one reusing the name/email.
                username: log.user && !log.user.entityStatus ? `${name} (removed)` : (name ?? ""),
                entityId: log.entityId ?? "",
                entityStatus: log.entityStatus,
                createdAt: log.createdAt.toISOString(),
            };
        });
    }
}
