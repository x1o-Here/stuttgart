"use client";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { CircleX, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import CalendarPopover from "@/components/shared/calendar-popover";
import { LoadingState } from "@/components/shared/loading-state";
import {
  RuledTable,
  TableCaption,
  TablePager,
} from "@/components/shared/ruled-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/firebase/firebase-client";
import { toDate } from "@/lib/helpers/to-date";
import { type AuditLogRow, auditLogsColumns } from "./audit-logs-columns";

const fuzzyFilter = (
  row: Row<AuditLogRow>,
  _columnId: string,
  value: string,
) => {
  const search = value.toLowerCase().trim();
  if (!search) return true;

  const { original } = row;
  const haystack = [
    original.action,
    original.description,
    original.companyId,
    original.companyName,
    original.userId,
    original.username,
    original.transactionId,
    original.entityStatus ? "active" : "inactive",
    original.createdAt?.toLocaleString() ?? "",
    original.createdAt?.toLocaleDateString() ?? "",
    original.createdAt?.toISOString().slice(0, 10) ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search);
};

export default function AuditLogsTable() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 15,
  });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const [logsSnap, usersSnap, companiesSnap] = await Promise.all([
        getDocs(
          query(collection(db, "auditLogs"), orderBy("createdAt", "desc")),
        ),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "companies")),
      ]);

      const usernames = new Map<string, string>();
      usersSnap.docs.forEach((userDoc) => {
        const data = userDoc.data();
        usernames.set(
          userDoc.id,
          typeof data.username === "string" && data.username
            ? data.username
            : typeof data.email === "string"
              ? data.email
              : userDoc.id,
        );
      });

      const companyNames = new Map<string, string>();
      companiesSnap.docs.forEach((companyDoc) => {
        const data = companyDoc.data();
        companyNames.set(
          companyDoc.id,
          typeof data.name === "string" && data.name
            ? data.name
            : companyDoc.id,
        );
      });

      const rows: AuditLogRow[] = logsSnap.docs.map((logDoc) => {
        const data = logDoc.data() as Record<string, unknown>;
        const userId = typeof data.userId === "string" ? data.userId : "";
        const companyId =
          typeof data.companyId === "string" ? data.companyId : "";

        return {
          id: logDoc.id,
          action: typeof data.action === "string" ? data.action : "",
          description:
            typeof data.description === "string" ? data.description : "",
          companyId,
          companyName: companyId
            ? (companyNames.get(companyId) ?? companyId)
            : "",
          userId,
          username: userId ? (usernames.get(userId) ?? userId) : "",
          transactionId:
            typeof data.transactionId === "string" ? data.transactionId : "",
          entityStatus: data.entityStatus !== false,
          createdAt: toDate(data.createdAt) ?? null,
        };
      });

      setLogs(rows);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const actionOptions = useMemo(
    () =>
      Array.from(new Set(logs.map((log) => log.action).filter(Boolean))).sort(),
    [logs],
  );

  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((log) => {
      if (log.companyId) {
        map.set(log.companyId, log.companyName || log.companyId);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [logs]);

  const userOptions = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((log) => {
      if (log.userId) {
        map.set(log.userId, log.username || log.userId);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [logs]);

  const dateFilteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!log.createdAt) {
        return !dateFrom && !dateTo;
      }
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (log.createdAt.getTime() < from.getTime()) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (log.createdAt.getTime() > to.getTime()) return false;
      }
      return true;
    });
  }, [logs, dateFrom, dateTo]);

  const columnFilters = useMemo(
    () =>
      [
        { id: "action", value: actionFilter },
        { id: "company", value: companyFilter },
        { id: "user", value: userFilter },
        { id: "entityStatus", value: statusFilter },
      ].filter((filter) => filter.value !== "all"),
    [actionFilter, companyFilter, userFilter, statusFilter],
  );

  const table = useReactTable({
    data: dateFilteredLogs,
    columns: auditLogsColumns,
    state: {
      globalFilter: search,
      sorting,
      columnFilters,
      pagination,
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    globalFilterFn: fuzzyFilter,
  });

  const hasActiveFilters =
    search.trim() !== "" ||
    actionFilter !== "all" ||
    companyFilter !== "all" ||
    userFilter !== "all" ||
    statusFilter !== "all" ||
    !!dateFrom ||
    !!dateTo;

  function clearFilters() {
    setSearch("");
    setActionFilter("all");
    setCompanyFilter("all");
    setUserFilter("all");
    setStatusFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  }

  if (loading) {
    return (
      <div className="p-4">
        <LoadingState
          message="Loading audit logs..."
          variant="skeleton"
          rows={6}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-3 px-4 py-3">
        <TableCaption
          label="Activity"
          count={table.getFilteredRowModel().rows.length}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search description, action, user or company"
              aria-label="Search audit log"
              className="pl-8"
            />
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger
              className="w-full bg-card sm:w-36"
              aria-label="Action"
            >
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actionOptions.map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger
              className="w-full bg-card sm:w-44"
              aria-label="Company"
            >
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {companyOptions.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-full bg-card sm:w-44" aria-label="User">
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {userOptions.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="w-full bg-card sm:w-36"
              aria-label="Status"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <div className="w-full sm:w-44">
            <CalendarPopover value={dateFrom} onChange={setDateFrom} />
          </div>
          <div className="w-full sm:w-44">
            <CalendarPopover value={dateTo} onChange={setDateTo} />
          </div>

          {hasActiveFilters ? (
            <Button type="button" variant="ghost" onClick={clearFilters}>
              <CircleX />
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <RuledTable
        table={table}
        emptyMessage="No audit entries match these filters."
      />
      <TablePager table={table} />
    </div>
  );
}
