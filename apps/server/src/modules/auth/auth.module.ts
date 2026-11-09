import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { FirebaseAuthGuard } from "./guards/firebase-auth.guard.js";
import { MaintenanceGuard } from "./guards/maintenance.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";

/**
 * Registers the global guards, in order: writes are refused while
 * MAINTENANCE_MODE=1, every route needs a valid Firebase token (unless marked
 * @Public()), then any @Roles() requirement is checked.
 */
@Module({
    providers: [
        { provide: APP_GUARD, useClass: MaintenanceGuard },
        { provide: APP_GUARD, useClass: FirebaseAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
    ],
})
export class AuthModule { }
