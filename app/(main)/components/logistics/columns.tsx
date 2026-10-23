import { type ColumnDef } from "@tanstack/react-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Badge } from "@/components/ui/badge";
import { toDate } from "@/lib/helpers/to-date";
import { tagsColumnFilterFn } from "@/lib/helpers/transaction-tags";
import { useLookupStore } from "@/stores/use-lookup-store";
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
  const name = departmentName?.trim();
  if (!name) return <span>-</span>;

  const dept = departments.find(
    (d) => d.name.trim().toLowerCase() === name.toLowerCase(),
  );
  const label = dept?.shortForm?.trim() || name;
  return (
    <Badge variant="neutral" className="max-w-full">
      <TruncatedText tooltip={dept?.name?.trim() || name}>
        {label}
      </TruncatedText>
    </Badge>
  );
}

export const transactionsColumns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "date",
    header: "Date",
    size: 90,
    cell: ({ row }) => {
      const date = toDate(row.getValue("date"));
      return (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {date ? date.toLocaleDateString() : "-"}
        </span>
      );
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
    header: () => <div className="text-right">Amount</div>,
    size: 125,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "LKR",
      }).format(amount);

      return (
        <TruncatedText className="block text-right font-mono tabular-nums text-foreground">
          {formatted}
        </TruncatedText>
      );
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
