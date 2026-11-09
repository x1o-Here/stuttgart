import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "../../../generated/prisma/client.js";
import type { AuthUser } from "../auth-user.type.js";
import { ROLES } from "../decorators/roles.decorator.js";

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(ctx: ExecutionContext): boolean {
        const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
        if (!roles?.length) return true;
        const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
        if (!user || !roles.includes(user.role)) throw new ForbiddenException("Insufficient role");
        return true;
    }
}