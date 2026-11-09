import {
    type CanActivate,
    type ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { FirebaseService } from "../../../infra/firebase/firebase.service.js";
import { PrismaService } from "../../../infra/prisma/prisma.service.js";
import type { AuthUser } from "../auth-user.type.js";
import { IS_PUBLIC } from "../decorators/public.decorator.js";

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly firebase: FirebaseService,
        private readonly prisma: PrismaService,
    ) { }

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        if (isPublic) return true;

        const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
        const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (!token) throw new UnauthorizedException("Not signed in");

        let uid: string;
        try {
            ({ uid } = await this.firebase.auth.verifyIdToken(token));
        } catch {
            throw new UnauthorizedException("Invalid or expired token");
        }

        const user = await this.prisma.user.findUnique({
            where: { id: uid },
            include: {
                companies: {
                    where: { company: { entityStatus: true } },
                    select: { companyId: true },
                },
            },
        });
        if (!user) throw new ForbiddenException("No profile for this account");
        if (!user.entityStatus) throw new ForbiddenException("This account has been removed");

        req.user = {
            uid: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            companyIds: user.companies.map((c) => c.companyId),
        };
        return true;
    }
}