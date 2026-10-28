"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { VatTab } from "./components/vat/vat-tab";

const TAB_TRIGGER =
  "h-10 flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 font-normal text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";

function ReportsContent() {
  const { accounts } = useAccountsContext();
  const { selectedMonthYear, selectedAccountId } = useReportFilter();
  const accountName =
    selectedAccountId === "all"
      ? "All accounts"
      : (accounts.find((account) => account.id === selectedAccountId)?.name ??
        "Account");

  const [tab, setTab] = useState("overview");

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-card font-sans">
      <PageHeader
        eyebrow="( Finance · Reports )"
        lead="Financial"
        title="reports."
        description={
          tab === "vat"
            ? "Quarterly VAT · tax year from 1 April"
            : `${selectedMonthYear} · ${accountName}`
        }
        actions={tab === "overview" ? <ReportFilters /> : null}
        className="border-b"
      />

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-0 border-b bg-transparent p-0 px-4 md:px-6">
          <TabsTrigger value="overview" className={TAB_TRIGGER}>
            01 / Overview
          </TabsTrigger>
          <TabsTrigger value="vat" className={TAB_TRIGGER}>
            02 / VAT
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 flex flex-col divide-y">
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
        </TabsContent>

        <TabsContent value="vat" className="mt-0 flex min-h-0 flex-1 flex-col">
          <VatTab />
        </TabsContent>
      </Tabs>
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
