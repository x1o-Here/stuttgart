"use client";

import ChartComponent from "./components/chart-component";
import MonthEndBalanceTable from "./components/month-end-balance-table";
import CashFlowTable from "./components/cash-flow-table";
import { ReportFilterProvider } from "@/contexts/report-filter-context";

export default function Reports() {
  return (
    <ReportFilterProvider>
      <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
        <div className="w-full h-full p-4 bg-zinc-100 rounded-lg overflow-y-auto">
          <div className="h-full grid grid-cols-4 gap-6 min-h-0">
            <div className="col-span-3 bg-white rounded-xl overflow-hidden h-full">
              <ChartComponent />
            </div>

            <div className="col-span-1 grid grid-rows-2 gap-6 h-full">
              <div className="bg-white rounded-xl overflow-hidden h-full">
                <MonthEndBalanceTable />
              </div>
              <div className="bg-white rounded-xl overflow-hidden h-full">
                <CashFlowTable />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ReportFilterProvider>
  );
}
