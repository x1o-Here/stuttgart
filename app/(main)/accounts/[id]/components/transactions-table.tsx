'use client'

import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { SortPopover } from "@/app/(main)/components/sort-popover";
import { TransactionsSortPopover } from "./transactions-sort-popover";
import { TransactionTypeFilterSelect } from "./transaction-type-filter-select";

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
};

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
    if (!value || value === "all") return true
    return row.getValue(columnId) === value
}

export function TransactionsDataTable<TData, TValue>({
    columns,
    data,
}: DataTableProps<TData, TValue>) {
    const [search, setSearch] = useState("");
    const [sorting, setSorting] = useState([{ id: "date", desc: true }]);
    const [columnFilters, setColumnFilters] = useState<
        { id: string; value: any }[]
    >([]);

    const table = useReactTable({
        data,
        columns,
        state: {
            globalFilter: search,
            sorting: sorting,
            columnFilters: columnFilters,
        },
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onGlobalFilterChange: setSearch,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        globalFilterFn: fuzzyFilter,
        filterFns: {
            transactionType: transactionTypeFilter
        },
    });

    return (
        <div className="flex flex-col flex-1 gap-4 min-h-0">
            <div className="w-full flex items-center justify-between gap-2 shrink-0">
                <TransactionsSortPopover
                    onSortChange={(column, direction) => {
                        setSorting([{ id: column, desc: direction === "desc" }]);
                    }}
                />

                <Input
                    placeholder="Search by Description or Amount..."
                    className="w-full"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                <TransactionTypeFilterSelect
                    value={
                        columnFilters.find((f) => f.id === "type")?.value ?? "all"
                    }
                    onChange={(value) => {
                        if (value === "all") {
                            setColumnFilters((prev) =>
                                prev.filter((f) => f.id !== "type")
                            )
                        } else {
                            setColumnFilters((prev) => [
                                ...prev.filter((f) => f.id !== "type"),
                                { id: "type", value },
                            ])
                        }
                    }}
                />

                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setColumnFilters([])}
                >
                    <CircleX />
                </Button>
            </div>

            <div className="flex-1 min-h-0 rounded-md border overflow-hidden">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                </Table>

                <div className="flex-1 overflow-y-auto">
                    <Table>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className="text-gray-600"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
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

                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className="text-gray-600"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
            </div>
        </div>
    )
}