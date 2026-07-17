import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import DeleteModal from "../modals/delete-modal";
import UpdateModal from "../modals/update-modal";

export type LookupColumns = {
  id: string;
  name: string;
  shortForm: string;
};

type ColumnOptions = {
  entityLabel: string;
};

export function getLookupColumns({
  entityLabel,
}: ColumnOptions): ColumnDef<LookupColumns>[] {
  const isVehicle = entityLabel.toLowerCase() === "vehicle";

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
      cell: ({ row }) => <p>{row.original.name}</p>,
      size: isVehicle ? 85 : 55,
    },
    {
      accessorKey: "shortForm",
      header: "Short Form",
      cell: ({ row }) => (
        <Badge variant="secondary" className="w-fit">
          {row.original.shortForm}
        </Badge>
      ),
      size: 30,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2 items-center">
          <UpdateModal entityLabel={entityLabel} initialData={row.original} />

          <DeleteModal
            entityLabel={entityLabel}
            itemId={row.original.id}
            itemName={row.original.name}
          />
        </div>
      ),
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
