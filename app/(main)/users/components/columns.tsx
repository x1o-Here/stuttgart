"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Badge } from "@/components/ui/badge";

import { UserActions } from "./user-actions";

export type UserData = {
  id: string;
  username: string;
  email: string;
  role: string;
  companies: string[];
  createdAt?: any;
};

export const columns: ColumnDef<UserData>[] = [
  {
    accessorKey: "username",
    header: "Username",
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <TruncatedText className="max-w-[220px] font-light italic text-muted-foreground">
        {row.getValue("email") as string}
      </TruncatedText>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue("role") as string;
      return (
        <Badge
          variant={
            role === "admin"
              ? "default"
              : role === "manager"
                ? "secondary"
                : "outline"
          }
        >
          {role}
        </Badge>
      );
    },
  },
  {
    accessorKey: "companies",
    header: "Companies",
    cell: ({ row }) => {
      const companies = row.getValue("companies") as string[];
      return (
        <TruncatedText className="max-w-[240px] font-light italic text-muted-foreground">
          {companies.join(", ")}
        </TruncatedText>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return <UserActions user={row.original} />;
    },
  },
];
