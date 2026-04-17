"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface ReportFilterContextType {
  selectedMonthYear: string;
  setSelectedMonthYear: (value: string) => void;
  selectedAccountId: string;
  setSelectedAccountId: (value: string) => void;
}

const ReportFilterContext = createContext<ReportFilterContextType | undefined>(
  undefined,
);

export function ReportFilterProvider({ children }: { children: ReactNode }) {
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleString("default", { month: "short", year: "numeric" });
  });
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  return (
    <ReportFilterContext.Provider
      value={{
        selectedMonthYear,
        setSelectedMonthYear,
        selectedAccountId,
        setSelectedAccountId,
      }}
    >
      {children}
    </ReportFilterContext.Provider>
  );
}

export function useReportFilter() {
  const context = useContext(ReportFilterContext);
  if (context === undefined) {
    throw new Error(
      "useReportFilter must be used within a ReportFilterProvider",
    );
  }
  return context;
}
