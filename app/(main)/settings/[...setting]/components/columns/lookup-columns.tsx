import type { ColumnDef } from "@tanstack/react-table";
import { Lock } from "lucide-react";
import { TruncatedText } from "@/components/shared/truncated-text";
import { Badge } from "@/components/ui/badge";
import { isProtectedAccountType } from "@/lib/constants/client-account";
import DeleteModal from "../modals/delete-modal";
import UpdateModal from "../modals/update-modal";

export type LookupColumns = {
  id: string;
  name: string;
  shortForm: string;
  isSystem?: boolean;
};

type ColumnOptions = {
  entityLabel: string;
};

export function getLookupColumns({
  entityLabel,
}: ColumnOptions): ColumnDef<LookupColumns>[] {
  const isAccountType = entityLabel.toLowerCase() === "account type";

  const columns: ColumnDef<LookupColumns>[] = [
    {
      accessorKey: "id",
      header: "No",
      cell: ({ row }) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {String(row.index + 1).padStart(2, "0")}
        </span>
      ),
      size: 56,
      enableGlobalFilter: false,
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <TruncatedText className="font-medium text-foreground">
            {row.original.name}
          </TruncatedText>
          {isAccountType && isProtectedAccountType(row.original) ? (
            <Badge variant="brand" className="shrink-0">
              System
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "shortForm",
      header: "Short form",
      cell: ({ row }) =>
        row.original.shortForm ? (
          <Badge variant="neutral" className="max-w-full font-mono">
            <TruncatedText>{row.original.shortForm}</TruncatedText>
          </Badge>
        ) : (
          <span className="text-muted-foreground">–</span>
        ),
      size: 160,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        if (isAccountType && isProtectedAccountType(row.original)) {
          return (
            <span
              className="flex items-center justify-end gap-1 text-xs text-muted-foreground"
              title="System-managed: can’t be edited or deleted"
            >
              <Lock className="size-3.5" />
              Locked
            </span>
          );
        }

        return (
          <div className="flex items-center justify-end gap-0.5">
            <UpdateModal entityLabel={entityLabel} initialData={row.original} />
            <DeleteModal
              entityLabel={entityLabel}
              itemId={row.original.id}
              itemName={row.original.name}
            />
          </div>
        );
      },
      size: 96,
    },
  ];

  return columns;
}
