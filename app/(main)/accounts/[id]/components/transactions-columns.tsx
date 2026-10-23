"use client";

import type { ColumnDef, FilterFnOption } from "@tanstack/react-table";
import { MoveDownRight, MoveUpRight } from "lucide-react";
import { TruncatedText } from "@/components/shared/truncated-text";
import { toDate } from "@/lib/helpers/to-date";
import { tagsColumnFilterFn } from "@/lib/helpers/transaction-tags";

export type Transaction = {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: "debit" | "credit";
  createdAt?: Date;
  tags?: string[];
  runningBalance?: number;
};

export const transactionsColumns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "type",
    header: "",
    size: 25,
    filterFn: "transactionType" as FilterFnOption<Transaction>,
    cell: ({ row }) =>
      row.getValue("type") === "debit" ? (
        <span className="flex text-destructive" title="Debit">
          <MoveUpRight size={16} strokeWidth={2.5} />
        </span>
      ) : (
        <span className="flex text-success" title="Credit">
          <MoveDownRight size={16} strokeWidth={2.5} />
        </span>
      ),
  },
  {
    accessorKey: "date",
    header: "Date",
    size: 100,
    sortingFn: (rowA, rowB, columnId) => {
      const dateA = toDate(rowA.getValue(columnId))?.getTime() || 0;
      const dateB = toDate(rowB.getValue(columnId))?.getTime() || 0;
      return dateA - dateB;
    },
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
    sortingFn: (rowA, rowB, columnId) => {
      const dateA = toDate(rowA.getValue(columnId))?.getTime() || 0;
      const dateB = toDate(rowB.getValue(columnId))?.getTime() || 0;
      return dateA - dateB;
    },
  },
  {
    accessorKey: "tags",
    header: "Tags",
    filterFn: (row, id, filterValues: string[]) =>
      tagsColumnFilterFn(row, id, filterValues),
  },
  {
    accessorKey: "description",
    header: "Description",
    size: 300,
    meta: { globalFilter: true },
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    size: 150,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "LKR",
      }).format(amount);

      return (
        <TruncatedText
          className={`block text-right font-mono tabular-nums ${
            row.getValue("type") === "debit"
              ? "text-destructive"
              : "text-success"
          }`}
        >
          {row.getValue("type") === "debit" ? "−" : "+"}
          {formatted}
        </TruncatedText>
      );
    },
    meta: { globalFilter: true },
  },
  {
    accessorKey: "runningBalance",
    header: () => <div className="text-right">Balance</div>,
    size: 150,
    enableSorting: false,
    cell: ({ row }) => {
      const balance = row.getValue("runningBalance") as number;
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "LKR",
      }).format(balance || 0);

      return (
        <TruncatedText className="block text-right font-mono tabular-nums text-foreground">
          {formatted}
        </TruncatedText>
      );
    },
  },
];
