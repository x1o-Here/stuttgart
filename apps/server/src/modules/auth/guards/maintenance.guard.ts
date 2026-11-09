import { type CanActivate, type ExecutionContext, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cutover window: with MAINTENANCE_MODE=1 every write is refused, so nothing
 * changes while data is being copied or checked. Reads keep working.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
    constructor(private readonly config: ConfigService) {}

    canActivate(ctx: ExecutionContext): boolean {
        if (this.config.get("MAINTENANCE_MODE") !== "1") return true;
        const req = ctx.switchToHttp().getRequest<Request>();
        if (READS.has(req.method)) return true;
        throw new ServiceUnavailableException("Stuttgart is being upgraded. Saving is paused — please try again shortly.");
    }
}
