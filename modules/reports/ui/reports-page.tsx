"use client";

import { AccountsLedgerProvider } from "@/modules/ledger";
import { ReportFilterProvider } from "../state/report-filter-context";
import CashFlowTable from "./cash-flow-table";
import ChartComponent from "./chart-component";
import CustomReportsCard from "./custom-reports-card";
import MonthEndBalanceTable from "./month-end-balance-table";

export default function Reports() {
  return (
    <AccountsLedgerProvider mode="all">
      <ReportFilterProvider>
        <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
          <div className="w-full h-full p-4 bg-zinc-100 rounded-lg min-h-0 overflow-hidden">
            <div className="h-full min-h-0 grid grid-cols-3 grid-rows-[2fr_1fr] gap-6">
              <div className="col-span-2 row-start-1 bg-white rounded-xl overflow-hidden min-h-0">
                <ChartComponent />
              </div>

              <div className="col-start-3 row-span-2 bg-white rounded-xl overflow-hidden min-h-0">
                <CustomReportsCard />
              </div>

              <div className="col-start-1 row-start-2 bg-white rounded-xl overflow-hidden min-h-0">
                <MonthEndBalanceTable />
              </div>

              <div className="col-start-2 row-start-2 bg-white rounded-xl overflow-hidden min-h-0">
                <CashFlowTable />
              </div>
            </div>
          </div>
        </div>
      </ReportFilterProvider>
    </AccountsLedgerProvider>
  );
}
