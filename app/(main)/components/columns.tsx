'use client'

import { Button } from "@/components/ui/button";
import { ColumnDef, FilterFnOption } from "@tanstack/react-table";
import { Eye, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import ActionsDropdownMenu from "./actions-dropdown";
import { Badge } from "@/components/ui/badge";

export type Vehicle = {
    id: string;
    purchasedDate: string;
    vehicleNo: string;
    make: string;
    yom: number;
    pCost: number;
    pRemaining?: number;
    totalCost?: number;
    sPrice: number;
    vehicleStatus: "active" | "in-maintenance" | "sold";
    soldDate?: string;
    buyerName?: string;
}

export const columns: ColumnDef<Vehicle>[] = [
    {
        accessorKey: "purchasedDate",
        header: "Purchased Date",
        filterFn: "purchasedDate" as FilterFnOption<Vehicle>,
        cell: ({ row }) => new Date(row.getValue("purchasedDate") as string).toLocaleDateString(),
    },
    {
        accessorKey: "vehicleNo",
        header: "Vehicle No",
        meta: { globalFilter: true }
    },
    {
        accessorKey: "make",
        header: "Make",
        meta: { globalFilter: true }
    },
    {
        accessorKey: "yom",
        header: "YOM",
    },
    {
        accessorKey: "pCost",
        header: "Purchase Cost",
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("pCost"));
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "LKR",
            }).format(amount)

            return <span>{formatted}</span>
        },
    },
    {
        accessorKey: "pRemaining",
        header: "Purchase Remaining",
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("pRemaining") || "0");

            // If fully paid, show green badge
            if (amount === 0) {
                return <Badge className="bg-green-500 text-white">Completed</Badge>
            }

            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "LKR",
            }).format(amount)

            return <span>{formatted}</span>
        },
    },
    {
        id: "months",
        header: "Months",
        cell: ({ row }) => {
            const purchasedDateStr = row.getValue("purchasedDate") as string;
            const purchasedDate = new Date(purchasedDateStr);
            const now = new Date();

            const yearsDiff = now.getFullYear() - purchasedDate.getFullYear();
            const monthsDiff = now.getMonth() - purchasedDate.getMonth();

            const totalMonths = yearsDiff * 12 + monthsDiff;

            return <span>{totalMonths}</span>;
        }
    },
    {
        accessorKey: "totalCost",
        header: "Total Cost",
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("totalCost"));
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "LKR",
            }).format(amount)

            return <span>{formatted}</span>
        },
    },
    {
        accessorKey: "sPrice",
        header: "Selling Price",
        filterFn: "sellingPrice" as FilterFnOption<Vehicle>,
        cell: ({ row }) => {
            const amount = row.original.sPrice ?? row.original.pCost ?? 0;
            return new Intl.NumberFormat("en-US", { style: "currency", currency: "LKR" }).format(amount);
        },
    },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
            const router = useRouter();
            const vehicle = row.original;

            return (
                <div className="flex items-center gap-2">
                    <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => router.push(`/vehicle/${vehicle.id}`)}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    <ActionsDropdownMenu vehicle={vehicle} />
                </div>
            );
        },
    }
]