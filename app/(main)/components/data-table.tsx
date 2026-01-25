'use client'

import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, CircleX } from "lucide-react";
import AddVehicleDialog from "./add-vehicle-dialog";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { SortPopover } from "./sort-popover";
import { PurchasedDateFilterPopover } from "./purchased-date-filter-popover";
import { SellingPriceFilterPopover } from "./selling-price-filter-popover";
import { useAllVehiclesContext } from "@/contexts/useAllVehiclesContext";

interface DataTableProps<TData, TValue> {
    tab: "active" | "sold";
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
};

const ACTIVE_SORT_OPTIONS: { label: string; column: string; direction: "asc" | "desc" }[] = [
    { label: "Purchased Date ↑", column: "purchasedDate", direction: "asc" },
    { label: "Purchased Date ↓", column: "purchasedDate", direction: "desc" },
    { label: "Vehicle No ↑", column: "vehicleNo", direction: "asc" },
    { label: "Vehicle No ↓", column: "vehicleNo", direction: "desc" },
    { label: "Selling Price ↑", column: "sPrice", direction: "asc" },
    { label: "Selling Price ↓", column: "sPrice", direction: "desc" },
];

const SOLD_SORT_OPTIONS: { label: string; column: string; direction: "asc" | "desc" }[] = [
    { label: "Sales Date ↑", column: "soldDate", direction: "asc" },
    { label: "Sales Date ↓", column: "soldDate", direction: "desc" },
    { label: "Vehicle No ↑", column: "vehicleNo", direction: "asc" },
    { label: "Vehicle No ↓", column: "vehicleNo", direction: "desc" },
    { label: "Sales Price ↑", column: "sPrice", direction: "asc" },
    { label: "Sales Price ↓", column: "sPrice", direction: "desc" },
];

const fuzzyFilter = (row: any, columnId: string, value: string) => {
    const searchValue = value.toLowerCase();
    const vehicleNo = row.original.vehicleNo.toLowerCase();
    const make = row.original.make.toLowerCase();

    return vehicleNo.includes(searchValue) || make.includes(searchValue);
};

const dateRangeFilter = (row: any, columnId: string, value: { from?: Date; to?: Date }) => {
    if (!value?.from && !value?.to) return true;

    const rowDate = new Date(row.original.purchasedDate);
    rowDate.setHours(0, 0, 0, 0);

    if (value.from) {
        const from = new Date(value.from);
        from.setHours(0, 0, 0, 0);
        if (rowDate < from) return false;
    }

    if (value.to) {
        const to = new Date(value.to);
        to.setHours(0, 0, 0, 0);
        if (rowDate > to) return false;
    }

    return true;
};

const sellingPriceRangeFilter = (row: any, columnId: string, value: { min?: number; max?: number }) => {
    const price = Number(row.original.sPrice);
    if (value.min !== undefined && price < value.min) return false;
    if (value.max !== undefined && price > value.max) return false;
    return true;
};

export function DataTable<TData, TValue>({
    tab,
    columns,
    data,
}: DataTableProps<TData, TValue>) {
    const { vehicles } = useAllVehiclesContext();
    const maxSellingPrice = useMemo(() => {
        if (!vehicles.length) return 500000; // default fallback

        return Math.max(
            ...vehicles.map(v => Math.max(v.salesDetails?.salesAmount || 0, v.totalCost || 0))
        );
    }, [vehicles]);

    const [search, setSearch] = useState("");
    const [sorting, setSorting] = useState([{ id: tab === "active" ? "purchasedDate" : "soldDate", desc: true }]);
    const [columnFilters, setColumnFilters] = useState<
        { id: string; value: any }[]
    >([]);
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

    const table = useReactTable({
        data,
        columns,
        state: {
            globalFilter: search,
            sorting: sorting,
            columnFilters: columnFilters,
            pagination: pagination,
        },
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onGlobalFilterChange: setSearch,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onPaginationChange: setPagination,
        globalFilterFn: fuzzyFilter,
        filterFns: {
            purchasedDate: dateRangeFilter,
            sellingPrice: sellingPriceRangeFilter,
        },
    });

    return (
        <div className="mt-2 p-4 bg-white rounded-md flex flex-col gap-4">
            <div className="rounded-lg w-full flex flex-col gap-2 text-gray-400">
                <div className="w-full flex items-center justify-between gap-4">
                    <Input
                        placeholder="Search by Vehicle No or Make..."
                        className="w-full"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <AddVehicleDialog />
                </div>

                <div className="w-full flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <SortPopover
                            options={tab === "active" ? ACTIVE_SORT_OPTIONS : SOLD_SORT_OPTIONS}
                            onSortChange={(column, direction) => {
                                setSorting([{ id: column, desc: direction === "desc" }]);
                            }}
                        />

                        <div className="flex items-center gap-2">
                            <PurchasedDateFilterPopover
                                tab={tab}
                                onDateChange={(from, to) =>
                                    setColumnFilters([{ id: tab === "active" ? "purchasedDate" : "soldDate", value: { from, to } }])
                                }
                            />

                            <SellingPriceFilterPopover
                                min={0}
                                max={maxSellingPrice}
                                onChange={(range) =>
                                    setColumnFilters([{ id: "sPrice", value: range }])
                                }
                            />

                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setColumnFilters([])}
                            >
                                <CircleX />
                            </Button>
                        </div>
                    </div>

                    <p className="font-light">
                        showing{" "}
                        <span className="font-normal">
                            {table.getRowModel().rows.length}
                        </span>{" "}
                        of{" "}
                        <span className="font-normal">
                            {table.getFilteredRowModel().rows.length}
                        </span>
                    </p>

                </div>
            </div>

            <div className="rounded-lg w-full text-gray-400">
                <div className="w-full overflow-hidden rounded-md border flex flex-col gap-4">
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
                        </TableBody>
                    </Table>

                    <Pagination className="justify-end">
                        <PaginationContent>
                            <PaginationItem>
                                <Button
                                    variant="ghost"
                                    onClick={() => table.previousPage()}
                                    disabled={!table.getCanPreviousPage()}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                            </PaginationItem>

                            <PaginationItem>
                                <span className="flex items-center px-4">
                                    {table.getState().pagination.pageIndex + 1}
                                </span>
                            </PaginationItem>

                            <PaginationItem>
                                <Button
                                    variant="ghost"
                                    onClick={() => table.nextPage()}
                                    disabled={!table.getCanNextPage()}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>

                </div>
            </div>
        </div>
    )
}