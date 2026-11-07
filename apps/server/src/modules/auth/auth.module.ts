import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { FirebaseAuthGuard } from "./guards/firebase-auth.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";

/**
 * Registers the global guards, in order: every route needs a valid Firebase
 * token (unless marked @Public()), then any @Roles() requirement is checked.
 */
@Module({
    providers: [
        { provide: APP_GUARD, useClass: FirebaseAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
    ],
})
export class AuthModule { }
