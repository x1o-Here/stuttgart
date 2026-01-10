'use client'

import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";

export type Vehicle = {
    id: string;
    date: string;
    vehicleNo: string;
    make: string;
    yom: number;
    pCost: number;
    pRemaining: number;
    totalCost: number;
    sPrice: number;
}

export const columns:ColumnDef<Vehicle>[] = [
    {
        accessorKey: "date",
        header: "Purchased Date",
    },
    {
        accessorKey: "vehicleNo",
        header: "Vehicle No",
    },
    {
        accessorKey: "make",
        header: "Make",
    },
    {
        accessorKey: "yom",
        header: "Year of Manufacture",
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
            const amount = parseFloat(row.getValue("pRemaining"));
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "LKR",
            }).format(amount)

            return <span>{formatted}</span>
        },
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
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("sPrice"));
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "LKR",
            }).format(amount)

            return <span>{formatted}</span>
        }
    },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
            const router = useRouter();
            const vehicle = row.original;

            return (
                <div className="flex items-center gap-2">
                    <Button variant="outline">Active</Button>
                    <Button 
                        size="icon-sm"
                        variant="outline"
                        onClick={() => router.push(`/vehicle/${vehicle.id}`)}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                        size="icon-sm"
                        variant="outline"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </div>
            );
        },
    }
]