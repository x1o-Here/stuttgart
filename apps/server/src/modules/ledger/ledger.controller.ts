import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import {
    type AccountCreate,
    accountCreateSchema,
    transactionInputSchema,
} from "@stuttgart/shared/schemas/ledger";
import type { z } from "zod";
import { type AuthUser, CompanyAccessGuard, CurrentUser } from "../auth/index.js";
import { LedgerService } from "./ledger.service.js";

type TransactionBody = z.output<typeof transactionInputSchema>;

@Controller("companies/:companyId")
@UseGuards(CompanyAccessGuard)
export class LedgerController {
    constructor(private readonly ledger: LedgerService) {}

    @Post("accounts")
    createAccount(
        @Param("companyId") companyId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: accountCreateSchema }) body: AccountCreate,
    ) {
        return this.ledger.createAccount(companyId, user, body);
    }

    @Post("transactions")
    createTransaction(
        @Param("companyId") companyId: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: transactionInputSchema }) body: TransactionBody,
    ) {
        return this.ledger.createTransaction(companyId, user, body);
    }

    @Post("transactions/:id/correct")
    correctTransaction(
        @Param("companyId") companyId: string,
        @Param("id") id: string,
        @CurrentUser() user: AuthUser,
        @Body({ schema: transactionInputSchema }) body: TransactionBody,
    ) {
        return this.ledger.correctTransaction(companyId, user, id, body);
    }

    @Post("transactions/:id/delete")
    deleteTransaction(
        @Param("companyId") companyId: string,
        @Param("id") id: string,
        @CurrentUser() user: AuthUser,
    ) {
        return this.ledger.deleteTransaction(companyId, user, id);
    }
}
