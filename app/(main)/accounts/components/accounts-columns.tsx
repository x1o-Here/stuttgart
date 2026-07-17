import { Account } from "@/hooks/use-accounts";
import { ColumnDef } from "@tanstack/react-table";

export const accountsColumns: ColumnDef<Account, unknown>[] = [
    {
        accessorKey: "name",
        header: "Name",
    },
    {
        accessorKey: "accountType",
        header: "Type",
    },
    {
        accessorKey: "balance",
        header: "Balance",
    },
];