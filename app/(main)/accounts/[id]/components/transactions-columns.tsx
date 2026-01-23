'use client'

import { ColumnDef, FilterFnOption } from "@tanstack/react-table";
import { MoveDownRight, MoveUpRight } from "lucide-react";
import { toDate } from "@/lib/helpers/to-date";

export type Transaction = {
    id: string;
    date: Date;
    description: string;
    amount: number;
    type: "debit" | "credit";
}

export const transactionsColumns: ColumnDef<Transaction>[] = [
    {
        accessorKey: "type",
        header: "",
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
        cell: ({ row }) => {
            const date = toDate(row.getValue("date"));
            return date ? date.toLocaleDateString() : "-";
        },
    },
    {
        accessorKey: "description",
        header: "Description",
        meta: { globalFilter: true }
    },
    {
        accessorKey: "amount",
        header: "Amount",
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