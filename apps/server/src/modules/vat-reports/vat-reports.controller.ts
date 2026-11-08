import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
    reportFiltersSchema as filtersSchema,
    reportInputSchema as reportSchema,
    vatPaymentDeleteSchema as vatDeleteSchema,
    vatPaymentInputSchema as vatPaymentSchema,
} from "@stuttgart/shared/schemas/vat-reports";
import type { z } from "zod";
import { type AuthUser, CompanyAccessGuard, CurrentUser } from "../auth/index.js";
import { VatReportsService } from "./vat-reports.service.js";

/** VAT tab payments and saved custom reports. */
@Controller("companies/:companyId")
@UseGuards(CompanyAccessGuard)
export class VatReportsController {
    constructor(private readonly service: VatReportsService) {}

    @Post("vat-payments")
    recordVatPayment(
        @Param("companyId") companyId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: vatPaymentSchema }) body: z.output<typeof vatPaymentSchema>,
    ) {
        return this.service.recordVatPayment(companyId, user, body);
    }

    @Post("vat-payments/:id/delete")
    deleteVatPayment(
        @Param("companyId") companyId: string,
        @Param("id") id: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: vatDeleteSchema }) body: z.output<typeof vatDeleteSchema>,
    ) {
        return this.service.deleteVatPayment(companyId, user, id, body.quarterLabel);
    }

    @Post("reports")
    createReport(
        @Param("companyId") companyId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: reportSchema }) body: z.output<typeof reportSchema>,
    ) {
        return this.service.createReport(companyId, user, body);
    }

    @Patch("reports/:id/filters")
    saveFilters(
        @Param("companyId") companyId: string,
        @Param("id") id: string,
        @Body({ schema: filtersSchema }) body: z.output<typeof filtersSchema>,
    ) {
        return this.service.saveReportFilters(companyId, id, body.filters);
    }
}
