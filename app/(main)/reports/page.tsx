"use client";

import { PageHeader } from "@/components/shared/page-header";
import {
  ReportFilterProvider,
  useReportFilter,
} from "@/contexts/report-filter-context";
import {
  AccountsLedgerProvider,
  useAccountsContext,
} from "@/contexts/useAccountsContext";
import AccountTypeBreakdownChart from "./components/account-type-breakdown-chart";
import CashFlowCompositionChart from "./components/cash-flow-composition-chart";
import CashFlowTable from "./components/cash-flow-table";
import ChartComponent from "./components/chart-component";
import CustomReportsCard from "./components/custom-reports-card";
import DepartmentActivityTable from "./components/department-activity-table";
import MonthEndBalanceTable from "./components/month-end-balance-table";
import ReportFilters from "./components/report-filters";
import ReportsSummaryCards from "./components/reports-summary-cards";
import TwelveMonthTrendChart from "./components/twelve-month-trend-chart";

function ReportsContent() {
  const { accounts } = useAccountsContext();
  const { selectedMonthYear, selectedAccountId } = useReportFilter();
  const accountName =
    selectedAccountId === "all"
      ? "All accounts"
      : (accounts.find((account) => account.id === selectedAccountId)?.name ??
        "Account");

  return (
    <div className="flex h-full flex-col divide-y overflow-y-auto bg-card font-sans">
      <PageHeader
        eyebrow="( Finance · Reports )"
        lead="Financial"
        title="reports."
        description={`${selectedMonthYear} · ${accountName}`}
        actions={<ReportFilters />}
      />

      <ReportsSummaryCards />

      <div className="grid gap-px bg-border lg:grid-cols-3">
        <div className="min-h-[24rem] bg-card lg:col-span-2 lg:min-h-[26rem]">
          <ChartComponent />
        </div>
        <div className="flex min-h-[24rem] bg-card lg:row-span-2">
          <CustomReportsCard />
        </div>
        <div className="flex h-80 bg-card">
          <MonthEndBalanceTable />
        </div>
        <div className="flex h-80 bg-card">
          <CashFlowTable />
        </div>
      </div>

      <div className="grid gap-px bg-border lg:grid-cols-2">
        <CashFlowCompositionChart />
        <AccountTypeBreakdownChart />
        <TwelveMonthTrendChart />
        <DepartmentActivityTable />
      </div>
    </div>
  );
}

export default function Reports() {
  return (
    <AccountsLedgerProvider mode="all">
      <ReportFilterProvider>
        <ReportsContent />
      </ReportFilterProvider>
    </AccountsLedgerProvider>
  );
}
