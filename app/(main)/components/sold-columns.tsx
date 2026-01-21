import { ColumnDef, FilterFnOption } from "@tanstack/react-table";
import { Vehicle } from "./columns";
import ActionsDropdownMenu from "./actions-dropdown";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { toDate } from "@/lib/helpers/to-date";

export type SoldVehicle = Vehicle & {
    soldDate?: string;
    buyerName?: string;
};

export const soldColumns: ColumnDef<SoldVehicle>[] = [
    {
        accessorKey: "soldDate",
        header: "Sale Date",
        filterFn: "salesDate" as FilterFnOption<SoldVehicle>,
        cell: ({ row }) => new Date(toDate(row.getValue("soldDate") as string)).toLocaleDateString(),
    },
    {
        accessorKey: "vehicleNo",
        header: "Vehicle No",
    },
    {
        accessorKey: "make",
        header: "Make",
    },
    {
        accessorKey: "yom",
        header: "YOM",
    },
    {
        accessorKey: "pCost",
        header: "Purchase Cost",
        cell: ({ row }) => {
            const amount = Number(row.getValue("pCost") ?? 0);
            return (
                <span>
                    {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "LKR",
                    }).format(amount)}
                </span>
            );
        },
    },
    {
        accessorKey: "totalCost",
        header: "Total Cost",
        cell: ({ row }) => {
            const amount = Number(row.getValue("totalCost") ?? 0);
            return (
                <span>
                    {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "LKR",
                    }).format(amount)}
                </span>
            );
        },
    },
    {
        accessorKey: "sPrice",
        header: "Sold Price",
        cell: ({ row }) => {
            const amount = Number(row.getValue("sPrice") ?? 0);
            return (
                <span>
                    {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "LKR",
                    }).format(amount)}
                </span>
            );
        },
    },
    {
        accessorKey: "sRemaining",
        header: "Sales Remaining",
        cell: ({ row }) => {
            const amount = Number(row.getValue("sRemaining") ?? 0);
            return (
                <span>
                    {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "LKR",
                    }).format(amount)}
                </span>
            );
        },
    },
    {
        accessorKey: "buyerName",
        header: "Buyer Name",
    },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
            const router = useRouter();
            const vehicle = row.original;

            return (
                <div className="flex items-center gap-2">
                    <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => router.push(`/vehicle/${vehicle.id}`)}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    <ActionsDropdownMenu vehicle={vehicle} />
                </div>
            );
        },
    },
];