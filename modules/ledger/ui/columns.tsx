import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { toDate } from "@/modules/platform";
import { tagsColumnFilterFn } from "../domain/helpers/transaction-tags";
import { useLookupStore } from "@/modules/catalog";
import { TransactionActions } from "./transaction-actions";

export type Transaction = {
  id: string;
  date: Date;
  description: string;
  department: string;
  vehicle?: string;
  voucher: number;
  creditingAccount: string;
  debitingAccount: string;
  creditingAccountId?: string;
  debitingAccountId?: string;
  createdAt?: Date;
  tags?: string[];
  amount: number;
};

function DepartmentBadge({ departmentName }: { departmentName: string }) {
  const departments = useLookupStore((state) => state.departments);
  const dept = departments.find((d) => d.name === departmentName);
  if (!dept) return null;
  return <Badge variant="secondary">{dept.shortForm}</Badge>;
}

export const transactionsColumns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "date",
    header: "Date",
    size: 90,
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
    filterFn: (row, id, filterValues: string[]) =>
      tagsColumnFilterFn(row, id, filterValues),
  },
  {
    accessorKey: "department",
    header: "Dept",
    size: 70,
    meta: { globalFilter: true },
    cell: ({ row }) => (
      <DepartmentBadge departmentName={row.original.department} />
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    size: 240,
    meta: { globalFilter: true },
  },
  {
    accessorKey: "vehicle",
    header: "Lorry",
    size: 75,
    meta: { globalFilter: true },
  },
  {
    accessorKey: "voucher",
    header: "V/No",
    size: 50,
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
    size: 125,
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
    size: 50,
    cell: ({ row }) => {
      return <TransactionActions transaction={row.original} />;
    },
  },
];
