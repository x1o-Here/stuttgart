import { Body, Controller, Delete, Param, Post, Put, UseGuards } from "@nestjs/common";
import {
    invoiceInputSchema,
    invoiceTemplateInputSchema,
    paymentInputSchema,
} from "@stuttgart/shared/schemas/ledger";
import { type AuthUser, CompanyAccessGuard, CurrentUser } from "../auth/index.js";
import { type InvoiceBody, type PaymentBody, SalesService, type TemplateBody } from "./sales.service.js";

/** Client invoices, their payments and the per-client invoice template. */
@Controller("companies/:companyId/clients/:clientId")
@UseGuards(CompanyAccessGuard)
export class SalesController {
    constructor(private readonly sales: SalesService) {}

    @Put("template")
    saveTemplate(
        @Param("companyId") companyId: string,
        @Param("clientId") clientId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: invoiceTemplateInputSchema }) body: TemplateBody,
    ) {
        return this.sales.saveTemplate(companyId, user, clientId, body);
    }

    @Post("invoices")
    createInvoice(
        @Param("companyId") companyId: string,
        @Param("clientId") clientId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: invoiceInputSchema }) body: InvoiceBody,
    ) {
        return this.sales.createInvoice(companyId, user, clientId, body);
    }

    @Put("invoices/:invoiceId")
    updateInvoice(
        @Param("companyId") companyId: string,
        @Param("clientId") clientId: string,
        @Param("invoiceId") invoiceId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: invoiceInputSchema }) body: InvoiceBody,
    ) {
        return this.sales.updateInvoice(companyId, user, clientId, invoiceId, body);
    }

    @Post("invoices/:invoiceId/complete")
    completeInvoice(
        @Param("companyId") companyId: string,
        @Param("clientId") clientId: string,
        @Param("invoiceId") invoiceId: string,
        @CurrentUser() user: AuthUser,
    ) {
        return this.sales.completeInvoice(companyId, user, clientId, invoiceId);
    }

    @Delete("invoices/:invoiceId")
    deleteInvoice(
        @Param("companyId") companyId: string,
        @Param("clientId") clientId: string,
        @Param("invoiceId") invoiceId: string,
        @CurrentUser() user: AuthUser,
    ) {
        return this.sales.deleteInvoice(companyId, user, clientId, invoiceId);
    }

    @Post("invoices/:invoiceId/payments")
    addPayment(
        @Param("companyId") companyId: string,
        @Param("clientId") clientId: string,
        @Param("invoiceId") invoiceId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: paymentInputSchema }) body: PaymentBody,
    ) {
        return this.sales.savePayment(companyId, user, clientId, invoiceId, body);
    }

    @Put("invoices/:invoiceId/payments/:paymentId")
    updatePayment(
        @Param("companyId") companyId: string,
        @Param("clientId") clientId: string,
        @Param("invoiceId") invoiceId: string,
        @Param("paymentId") paymentId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: paymentInputSchema }) body: PaymentBody,
    ) {
        return this.sales.savePayment(companyId, user, clientId, invoiceId, body, paymentId);
    }

    @Delete("invoices/:invoiceId/payments/:paymentId")
    deletePayment(
        @Param("companyId") companyId: string,
        @Param("clientId") clientId: string,
        @Param("invoiceId") invoiceId: string,
        @Param("paymentId") paymentId: string,
        @CurrentUser() user: AuthUser,
    ) {
        return this.sales.deletePayment(companyId, user, clientId, invoiceId, paymentId);
    }
}
