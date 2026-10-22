import type { ColumnDef } from "@tanstack/react-table";
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
  const isVehicle = entityLabel.toLowerCase() === "vehicle";
  const isAccountType = entityLabel.toLowerCase() === "account type";

  const columns: ColumnDef<LookupColumns>[] = [
    {
      accessorKey: "id",
      header: "#",
      cell: ({ row }) => <p>{row.index + 1}</p>,
      size: 5,
    },
    {
      accessorKey: "name",
      header: isVehicle ? "Vehicle Number" : "Name",
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <TruncatedText>{row.original.name}</TruncatedText>
          {isAccountType && isProtectedAccountType(row.original) ? (
            <Badge variant="outline" className="shrink-0 text-xs">
              System
            </Badge>
          ) : null}
        </div>
      ),
      size: isVehicle ? 85 : 55,
    },
    {
      accessorKey: "shortForm",
      header: "Short Form",
      cell: ({ row }) => (
        <Badge variant="secondary" className="w-fit max-w-full">
          <TruncatedText>{row.original.shortForm}</TruncatedText>
        </Badge>
      ),
      size: 30,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        if (isAccountType && isProtectedAccountType(row.original)) {
          return (
            <span className="text-xs text-muted-foreground">Locked</span>
          );
        }

        return (
          <div className="flex gap-2 items-center">
            <UpdateModal entityLabel={entityLabel} initialData={row.original} />

            <DeleteModal
              entityLabel={entityLabel}
              itemId={row.original.id}
              itemName={row.original.name}
            />
          </div>
        );
      },
      size: 10,
    },
  ];

  if (isVehicle) {
    return columns.filter(
      (col) => !("accessorKey" in col) || col.accessorKey !== "shortForm",
    );
  }

  return columns;
}
