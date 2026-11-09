"use client";

import { ArrowUpRight, FileText, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { Input } from "@/components/ui/input";
import { useCustomReports } from "@/hooks/use-custom-reports";
import AddCustomReportDialog from "./add-custom-report-dialog";
import { ReportPanel } from "./report-panel";

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
    <ReportPanel
      label="04 / Custom reports"
      caption={
        loading
          ? "Loading…"
          : `${reports.length} saved report${reports.length === 1 ? "" : "s"}`
      }
      actions={<AddCustomReportDialog />}
      bodyClassName="p-0"
    >
      <div className="px-5 pb-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by report name"
            aria-label="Search reports"
            className="pl-8"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t">
        {loading ? (
          <LoadingState message="Loading reports..." variant="compact" />
        ) : error ? (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
            <FileText className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {search.trim()
                ? "No reports match this search."
                : "No custom reports yet. Create one to save a date range and accounts."}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {filteredReports.map((report, index) => (
              <li key={report.id}>
                <Link
                  href={`/reports/${report.id}`}
                  className="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
                >
                  <span className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {report.name}
                    </p>
                    {report.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {report.description}
                      </p>
                    ) : null}
                    <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
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
                  <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ReportPanel>
  );
}
