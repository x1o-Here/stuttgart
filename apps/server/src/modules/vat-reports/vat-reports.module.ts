import { Module } from "@nestjs/common";
import { VatReportsController } from "./vat-reports.controller.js";
import { VatReportsService } from "./vat-reports.service.js";

@Module({ controllers: [VatReportsController], providers: [VatReportsService] })
export class VatReportsModule {}
