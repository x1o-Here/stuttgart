"use client";

import { ChevronRight, FileText, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useCustomReports } from "@/hooks/use-custom-reports";
import AddCustomReportDialog from "./add-custom-report-dialog";

export default function CustomReportsCard() {
  const { reports, loading, error } = useCustomReports();
  const [search, setSearch] = useState("");

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return reports;
    return reports.filter((report) =>
      report.name.toLowerCase().includes(query),
    );
  }, [reports, search]);

  return (
    <div className="bg-white rounded-xl overflow-hidden flex flex-col h-full p-6">
      <div className="border-b border-zinc-100 pb-4 mb-4 shrink-0 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-zinc-800">Custom Reports</h3>
            <p className="text-xs text-zinc-500">
              {loading
                ? "Loading..."
                : `${reports.length} report${reports.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <AddCustomReportDialog />
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by report name..."
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-zinc-500 py-6 text-center">
            Loading reports...
          </p>
        ) : error ? (
          <p className="text-sm text-red-500 py-6 text-center">{error}</p>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <FileText className="h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500">
              {search.trim()
                ? "No reports match your search"
                : "No custom reports yet"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredReports.map((report) => (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-zinc-50"
              >
                <div className="mt-0.5 rounded-md bg-white border border-zinc-200 p-1.5 shrink-0">
                  <FileText className="h-3.5 w-3.5 text-zinc-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-800 truncate group-hover:text-zinc-950">
                    {report.name}
                  </p>
                  {report.description ? (
                    <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">
                      {report.description}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {report.fromDate && report.toDate
                      ? `${report.fromDate.toLocaleDateString()} – ${report.toDate.toLocaleDateString()}`
                      : report.createdAt
                        ? report.createdAt.toLocaleDateString()
                        : null}
                    {report.accountIds && report.accountIds.length > 0
                      ? ` · ${report.accountIds.length} account${report.accountIds.length === 1 ? "" : "s"}`
                      : null}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-300 shrink-0 mt-1 group-hover:text-zinc-500" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
