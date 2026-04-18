"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

import { UserActions } from "./user-actions";

export type UserData = {
  id: string;
  username: string;
  email: string;
  role: string;
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
      <span className="font-light italic text-muted-foreground">
        {row.getValue("email")}
      </span>
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
    id: "actions",
    cell: ({ row }) => {
      return <UserActions user={row.original} />;
    },
  },
];
