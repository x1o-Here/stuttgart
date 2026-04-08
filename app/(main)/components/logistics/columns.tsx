import { Button } from "@/components/ui/button";
import { toDate } from "@/lib/helpers/to-date";
import { ColumnDef, FilterFnOption } from "@tanstack/react-table";
import { TransactionActions } from "./transaction-actions";

export type Transaction = {
    id: string;
    date: Date;
    description: string;
    creditingAccount: string;
    debitingAccount: string;
    creditingAccountId?: string;
    debitingAccountId?: string;
    createdAt?: Date;
    tags?: string[];
    amount: number;
};

export const transactionsColumns: ColumnDef<Transaction>[] = [
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
        accessorKey: "createdAt",
        header: "Created",
    },
    {
        accessorKey: "tags",
        header: "Tags",
        filterFn: (row, id, filterValues: string[]) => {
            if (!filterValues || filterValues.length === 0) return true;

            const tags = (row.getValue(id) as string[]) || [];
            const hasRestricted = tags.includes("deleted") || tags.includes("corrected") || tags.includes("reversal");
            const isActive = !hasRestricted;

            for (const filter of filterValues) {
                if (filter === "active" && isActive) return true;
                if (filter !== "active" && tags.includes(filter)) return true;
            }
            return false;
        }
    },
    {
        accessorKey: "description",
        header: "Description",
        size: 300,
        meta: { globalFilter: true },
    },
    {
        accessorKey: "creditingAccount",
        header: "Crediting To",
        size: 150,
        meta: { globalFilter: true },
    },
    {
        accessorKey: "debitingAccount",
        header: "Debitng From",
        size: 150,
        meta: { globalFilter: true },
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
            }).format(amount);

            return <span>{formatted}</span>;
        },
        meta: { globalFilter: true },
    },
    {
        id: "actions",
        size: 40,
        cell: ({ row }) => {
            return <TransactionActions transaction={row.original} />;
        },
    }
];