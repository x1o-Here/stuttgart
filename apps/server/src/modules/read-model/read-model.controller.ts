import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { CompanyAccessGuard } from "../auth/index.js";
import { ReadModelService } from "./read-model.service.js";

/**
 * GET /companies/:c/docs/<path>  → the Firestore-shaped record(s) at that path
 * GET /companies/:c/ledger?accounts=a,b → per-account ledger entries in one call
 */
@Controller("companies/:companyId")
@UseGuards(CompanyAccessGuard)
export class ReadModelController {
    constructor(private readonly readModel: ReadModelService) {}

    @Get("ledger")
    ledger(@Param("companyId") companyId: string, @Query("accounts") accounts = "") {
        const ids = accounts.split(",").map((s) => s.trim()).filter(Boolean);
        return this.readModel.ledger(companyId, ids);
    }

    @Get("docs")
    root(@Param("companyId") companyId: string) {
        return this.readModel.read(companyId, "");
    }

    @Get("docs/*path")
    docs(@Param("companyId") companyId: string, @Param("path") path: string | string[]) {
        return this.readModel.read(companyId, Array.isArray(path) ? path.join("/") : path);
    }
}
