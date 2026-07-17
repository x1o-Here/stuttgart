import type { ColumnDef } from "@tanstack/react-table";
import type { Account } from "../domain/types";

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
