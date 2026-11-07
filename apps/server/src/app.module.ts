import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env.schema.js";
import { FirebaseModule } from "./infra/firebase/firebase.module.js";
import { PrismaModule } from "./infra/prisma/prisma.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { CompaniesModule } from "./modules/companies/companies.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { UsersModule } from "./modules/users/users.module.js";

@Module({
    imports: [
        // Infrastructure (global: injectable everywhere without re-importing)
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        PrismaModule,
        FirebaseModule,

        // Features
        AuthModule,
        HealthModule,
        UsersModule,
        CompaniesModule,
    ],
})
export class AppModule { }
