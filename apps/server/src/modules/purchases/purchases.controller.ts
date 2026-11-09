import { Body, Controller, Delete, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import {
    partyStatusSchema,
    paymentInputSchema,
    supplierInputSchema,
    supplierInvoiceInputSchema,
} from "@stuttgart/shared/schemas/ledger";
import { type AuthUser, CompanyAccessGuard, CurrentUser } from "../auth/index.js";
import {
    type PaymentBody,
    PurchasesService,
    type SupplierBody,
    type SupplierInvoiceBody,
} from "./purchases.service.js";

/** Suppliers, their invoices and payments. */
@Controller("companies/:companyId/suppliers")
@UseGuards(CompanyAccessGuard)
export class PurchasesController {
    constructor(private readonly purchases: PurchasesService) {}

    @Post()
    createSupplier(
        @Param("companyId") companyId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: supplierInputSchema }) body: SupplierBody,
    ) {
        return this.purchases.createSupplier(companyId, user, body);
    }

    @Patch(":supplierId")
    updateSupplier(
        @Param("companyId") companyId: string,
        @Param("supplierId") supplierId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: supplierInputSchema }) body: SupplierBody,
    ) {
        return this.purchases.updateSupplier(companyId, user, supplierId, body);
    }

    @Patch(":supplierId/status")
    setStatus(
        @Param("companyId") companyId: string,
        @Param("supplierId") supplierId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: partyStatusSchema }) body: { status: "active" | "inactive" },
    ) {
        return this.purchases.setSupplierStatus(companyId, user, supplierId, body.status);
    }

    @Post(":supplierId/invoices")
    createInvoice(
        @Param("companyId") companyId: string,
        @Param("supplierId") supplierId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: supplierInvoiceInputSchema }) body: SupplierInvoiceBody,
    ) {
        return this.purchases.createInvoice(companyId, user, supplierId, body);
    }

    @Put(":supplierId/invoices/:invoiceId")
    updateInvoice(
        @Param("companyId") companyId: string,
        @Param("supplierId") supplierId: string,
        @Param("invoiceId") invoiceId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: supplierInvoiceInputSchema }) body: SupplierInvoiceBody,
    ) {
        return this.purchases.updateInvoice(companyId, user, supplierId, invoiceId, body);
    }

    @Delete(":supplierId/invoices/:invoiceId")
    deleteInvoice(
        @Param("companyId") companyId: string,
        @Param("supplierId") supplierId: string,
        @Param("invoiceId") invoiceId: string,
        @CurrentUser() user: AuthUser,
    ) {
        return this.purchases.deleteInvoice(companyId, user, supplierId, invoiceId);
    }

    @Post(":supplierId/invoices/:invoiceId/payments")
    addPayment(
        @Param("companyId") companyId: string,
        @Param("supplierId") supplierId: string,
        @Param("invoiceId") invoiceId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: paymentInputSchema }) body: PaymentBody,
    ) {
        return this.purchases.savePayment(companyId, user, supplierId, invoiceId, body);
    }

    @Put(":supplierId/invoices/:invoiceId/payments/:paymentId")
    updatePayment(
        @Param("companyId") companyId: string,
        @Param("supplierId") supplierId: string,
        @Param("invoiceId") invoiceId: string,
        @Param("paymentId") paymentId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: paymentInputSchema }) body: PaymentBody,
    ) {
        return this.purchases.savePayment(companyId, user, supplierId, invoiceId, body, paymentId);
    }

    @Delete(":supplierId/invoices/:invoiceId/payments/:paymentId")
    deletePayment(
        @Param("companyId") companyId: string,
        @Param("supplierId") supplierId: string,
        @Param("invoiceId") invoiceId: string,
        @Param("paymentId") paymentId: string,
        @CurrentUser() user: AuthUser,
    ) {
        return this.purchases.deletePayment(companyId, user, supplierId, invoiceId, paymentId);
    }
}
