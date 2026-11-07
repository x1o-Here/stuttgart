import { Controller, Get } from "@nestjs/common";
import { type AuthUser, CurrentUser } from "../auth/index.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";

@Controller("me")
export class MeController {
    constructor(private readonly prisma: PrismaService) { }

    @Get()
    async me(@CurrentUser() user: AuthUser) {
        const companies = await this.prisma.company.findMany({
            where: { id: { in: user.companyIds } },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        });
        return { uid: user.uid, username: user.username, role: user.role, companies };
    }
}