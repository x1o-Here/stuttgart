import { Module } from "@nestjs/common";
import { InvoiceNumbersController, SalesController } from "./sales.controller.js";
import { SalesService } from "./sales.service.js";

@Module({ controllers: [InvoiceNumbersController, SalesController], providers: [SalesService] })
export class SalesModule {}
