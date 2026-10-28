import type { ColumnDef } from "@tanstack/react-table";
import type { Account } from "@/hooks/use-accounts";
import { isHiddenByDefaultAccountType } from "@/lib/constants/client-account";

/** Filter value that shows every account type except Client and Supplier. */
export const DEFAULT_ACCOUNT_TYPE_FILTER = "__default";

export const accountsColumns: ColumnDef<Account, unknown>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "accountType",
    header: "Type",
    filterFn: (row, id, value: string) => {
      const type = row.getValue<string | undefined>(id);
      if (value === DEFAULT_ACCOUNT_TYPE_FILTER) {
        return !isHiddenByDefaultAccountType(type);
      }
      return (type ?? "").trim().toLowerCase() === value.trim().toLowerCase();
    },
  },
  {
    accessorKey: "balance",
    header: "Balance",
  },
];
