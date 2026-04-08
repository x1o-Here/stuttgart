'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import { useState } from "react";
import { TransactionsSortPopover } from "../../accounts/[id]/components/transactions-sort-popover";
import { Input } from "@/components/ui/input";
import { TransactionTypeFilterSelect } from "../../accounts/[id]/components/transaction-type-filter-select";
import { Button } from "@/components/ui/button";
import { CircleX, Filter } from "lucide-react";
import { AddTransactionDialog } from "./add-transaction-dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { TransactionsTagFilter } from "./transactions-tag-filter";

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
}

const fuzzyFilter = (row: any, _columnId: string, value: string) => {
    const searchValue = value.toLowerCase();

    return Object.values(row.original).some((cellValue) => {
        if (cellValue === undefined || cellValue === null) return false;

        // Dates
        if (cellValue instanceof Date) {
            return cellValue.toLocaleDateString().toLowerCase().includes(searchValue);
        }

        // Numbers
        if (typeof cellValue === "number") {
            return cellValue.toString().includes(searchValue);
        }

        // Strings
        if (typeof cellValue === "string") {
            return cellValue.toLowerCase().includes(searchValue);
        }

        return false;
    });
};

const transactionTypeFilter = (row: any, columnId: string, value: string) => {
    if (!value || value === "all") return true;
    return row.getValue(columnId) === value;
};

export function DashboardTransactionsTable<TData, TValue>({
    columns,
    data
}: DataTableProps<TData, TValue>) {
    const [search, setSearch] = useState("");
    const [sorting, setSorting] = useState([{ id: "date", desc: true }, { id: "createdAt", desc: true }]);
    const [columnFilters, setColumnFilters] = useState<
        { id: string; value: any }[]
    >([]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10,
    });

    const table = useReactTable({
        data,
        columns,
        state: {
            globalFilter: search,
            sorting: sorting,
            columnFilters: columnFilters,
            pagination,
            columnVisibility: {
                createdAt: false,
                tags: false,
            }
        },
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onGlobalFilterChange: setSearch,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onPaginationChange: setPagination,
        globalFilterFn: fuzzyFilter,
        filterFns: {
            transactionType: transactionTypeFilter,
        },
    });

    return (
        <div className="bg-white rounded-lg p-4">
            <div className="flex flex-col flex-1 gap-4 min-h-0">
                <div className="w-full flex items-center justify-between gap-36 shrink-0">
                    <div className="w-full flex items-center gap-2">
                        <TransactionsSortPopover
                            onSortChange={(column, direction) => {
                                setSorting([
                                    { id: column, desc: direction === "desc" },
                                    { id: "createdAt", desc: true }
                                ]);
                            }}
                        />

                        <Input
                            placeholder="Search by Description or Amount..."
                            className="w-full min-w-96"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />

                        <TransactionsTagFilter table={table} />
                    </div>

                    <AddTransactionDialog />
                </div>

                <div className="flex-1 min-h-0 rounded-md border overflow-auto relative">
                    <Table className="table-fixed w-full border-separate border-spacing-0">
                        <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow
                                    key={headerGroup.id}
                                    className="bg-white hover:bg-white"
                                >
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            className="border-l border-gray-100 first:border-l-0"
                                            style={{ width: `${header.getSize()}px` }}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext(),
                                                )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className="text-gray-600"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell
                                                key={cell.id}
                                                className="border-l border-b border-gray-100 first:border-l-0"
                                                style={{ width: `${cell.column.getSize()}px` }}
                                            >
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext(),
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 text-center text-gray-600"
                                    >
                                        No results.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Pagination className="flex items-center justify-end">
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious
                                onClick={() => table.previousPage()}
                                className={!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                        </PaginationItem>

                        {Array.from({ length: table.getPageCount() }, (_, i) => (
                            <PaginationItem key={i}>
                                <PaginationLink
                                    onClick={() => table.setPageIndex(i)}
                                    isActive={table.getState().pagination.pageIndex === i}
                                    className="cursor-pointer"
                                >
                                    {i + 1}
                                </PaginationLink>
                            </PaginationItem>
                        ))}

                        <PaginationItem>
                            <PaginationNext
                                onClick={() => table.nextPage()}
                                className={!table.getCanNextPage() ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </div>
        </div>
    )
}