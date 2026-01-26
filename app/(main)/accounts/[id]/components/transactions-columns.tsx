'use client'

import { ColumnDef, FilterFnOption } from "@tanstack/react-table";
import { MoveDownRight, MoveUpRight } from "lucide-react";
import { toDate } from "@/lib/helpers/to-date";

import { Badge } from "@/components/ui/badge";
import { useAllVehiclesContext } from "@/contexts/useAllVehiclesContext";

export type Transaction = {
    id: string;
    date: Date;
    description: string;
    amount: number;
    type: "debit" | "credit";
    vehicleId?: string;
}

const VehicleCell = ({ vehicleId }: { vehicleId?: string }) => {
    const { vehicles } = useAllVehiclesContext()
    if (!vehicleId) return <span className="text-muted-foreground">-</span>

    const vehicle = vehicles.find(v => v.id === vehicleId)
    const vehicleNo = vehicle?.vehicle?.vehicleNo

    return (
        <Badge variant="outline" className="font-mono">
            {vehicleNo || vehicleId}
        </Badge>
    )
}

export const transactionsColumns: ColumnDef<Transaction>[] = [
    {
        accessorKey: "type",
        header: "",
        size: 25,
        filterFn: "transactionType" as FilterFnOption<Transaction>,
        cell: ({ row }) => row.getValue("type") === "debit" ? (
            <span className="text-red-500">
                <MoveUpRight size={18} strokeWidth={3} />
            </span>
        ) : (
            <span className="text-green-500">
                <MoveDownRight size={18} strokeWidth={3} />
            </span>
        ),
    },
    {
        accessorKey: "date",
        header: "Date",
        size: 100,
        cell: ({ row }) => {
            const date = toDate(row.getValue("date"));
            return date ? date.toLocaleDateString() : "-";
        },
    },
    {
        accessorKey: "vehicleId",
        header: "Vehicle",
        size: 150,
        cell: ({ row }) => <VehicleCell vehicleId={row.getValue("vehicleId")} />,
    },
    {
        accessorKey: "description",
        header: "Description",
        size: 300,
        meta: { globalFilter: true }
    },
    {
        accessorKey: "amount",
        header: "Amount",
        size: 150,
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("amount"));
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "LKR",
            }).format(amount)

            return <span>{formatted}</span>
        },
        meta: { globalFilter: true }
    }
]