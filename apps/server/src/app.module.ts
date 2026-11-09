import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env.schema.js";
import { FirebaseModule } from "./infra/firebase/firebase.module.js";
import { PrismaModule } from "./infra/prisma/prisma.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { ClientsModule } from "./modules/clients/clients.module.js";
import { CompaniesModule } from "./modules/companies/companies.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { InventoryModule } from "./modules/inventory/inventory.module.js";
import { LedgerModule } from "./modules/ledger/ledger.module.js";
import { LookupsModule } from "./modules/lookups/lookups.module.js";
import { PurchasesModule } from "./modules/purchases/purchases.module.js";
import { ReadModelModule } from "./modules/read-model/read-model.module.js";
import { SalesModule } from "./modules/sales/sales.module.js";
import { VatReportsModule } from "./modules/vat-reports/vat-reports.module.js";
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
        ClientsModule,
        LookupsModule,
        AuditModule,
        LedgerModule,
        SalesModule,
        PurchasesModule,
        ReadModelModule,
        InventoryModule,
        VatReportsModule,
    ],
})
export class AppModule { }
