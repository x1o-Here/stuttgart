import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "../auth-user.type.js";

export const CurrentUser = createParamDecorator(
    (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);