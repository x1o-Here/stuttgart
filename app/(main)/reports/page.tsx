"use client";

import { AccountsLedgerProvider } from "@/contexts/useAccountsContext";
import { ReportFilterProvider } from "@/contexts/report-filter-context";
import AccountTypeBreakdownChart from "./components/account-type-breakdown-chart";
import CashFlowCompositionChart from "./components/cash-flow-composition-chart";
import CashFlowTable from "./components/cash-flow-table";
import ChartComponent from "./components/chart-component";
import CustomReportsCard from "./components/custom-reports-card";
import DepartmentActivityTable from "./components/department-activity-table";
import MonthEndBalanceTable from "./components/month-end-balance-table";
import ReportsSummaryCards from "./components/reports-summary-cards";
import TwelveMonthTrendChart from "./components/twelve-month-trend-chart";

export default function Reports() {
  return (
    <AccountsLedgerProvider mode="all">
      <ReportFilterProvider>
        <div className="min-h-screen h-full p-4 font-sans">
          <div className="h-full min-h-0 overflow-y-auto rounded-lg bg-zinc-100 p-4">
            <div className="flex flex-col gap-6">
              {/* Existing dashboard — unchanged composition */}
              <div className="grid min-h-[70vh] grid-cols-3 grid-rows-[2fr_1fr] gap-6">
                <div className="col-span-2 row-start-1 min-h-0 overflow-hidden rounded-xl bg-white">
                  <ChartComponent />
                </div>

                <div className="col-start-3 row-span-2 min-h-0 overflow-hidden rounded-xl bg-white">
                  <CustomReportsCard />
                </div>

                <div className="col-start-1 row-start-2 min-h-0 overflow-hidden rounded-xl bg-white">
                  <MonthEndBalanceTable />
                </div>

                <div className="col-start-2 row-start-2 min-h-0 overflow-hidden rounded-xl bg-white">
                  <CashFlowTable />
                </div>
              </div>

              {/* Additional analytics */}
              <section className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-800">
                    More analytics
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Extra views based on the same account filters above.
                  </p>
                </div>

                <ReportsSummaryCards />

                <div className="grid gap-6 lg:grid-cols-2">
                  <CashFlowCompositionChart />
                  <AccountTypeBreakdownChart />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <TwelveMonthTrendChart />
                  <DepartmentActivityTable />
                </div>
              </section>
            </div>
          </div>
        </div>
      </ReportFilterProvider>
    </AccountsLedgerProvider>
  );
}
