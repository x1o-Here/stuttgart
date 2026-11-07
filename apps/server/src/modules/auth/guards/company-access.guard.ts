import {
    BadRequestException,
    type CanActivate,
    type ExecutionContext,
    ForbiddenException,
    Injectable,
} from "@nestjs/common";
import type { AuthUser } from "../auth-user.type.js";

@Injectable()
export class CompanyAccessGuard implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean {
        const req = ctx.switchToHttp().getRequest();
        const companyId: string | undefined = req.params?.companyId;
        const user: AuthUser | undefined = req.user;
        if (!companyId) throw new BadRequestException("companyId is required");
        if (!user?.companyIds.includes(companyId)) {
            throw new ForbiddenException("No access to this company");
        }
        return true;
    }
}