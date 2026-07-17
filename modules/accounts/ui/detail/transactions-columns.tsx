"use client";

import type { ColumnDef, FilterFnOption } from "@tanstack/react-table";
import { MoveDownRight, MoveUpRight } from "lucide-react";
import { toDate } from "@/modules/platform";
import { tagsColumnFilterFn } from "@/modules/ledger";

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
    sortingFn: (rowA, rowB, columnId) => {
      const dateA = toDate(rowA.getValue(columnId))?.getTime() || 0;
      const dateB = toDate(rowB.getValue(columnId))?.getTime() || 0;
      return dateA - dateB;
    },
    cell: ({ row }) => {
      const date = toDate(row.getValue("date"));
      return date ? date.toLocaleDateString() : "-";
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
    accessorKey: "runningBalance",
    header: "Running Balance",
    size: 150,
    enableSorting: false,
    cell: ({ row }) => {
      const balance = row.getValue("runningBalance") as number;
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "LKR",
      }).format(balance || 0);

      return <span className="font-medium">{formatted}</span>;
    },
  },
];
