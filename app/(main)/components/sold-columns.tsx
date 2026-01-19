import { ColumnDef, FilterFnOption } from "@tanstack/react-table";
import { Vehicle } from "./columns";
import ActionsDropdownMenu from "./actions-dropdown";

export type SoldVehicle = Vehicle & {
    soldDate?: string;
    buyerName?: string;
};

export const soldColumns: ColumnDef<SoldVehicle>[] = [
    {
        accessorKey: "soldDate",
        header: "Sale Date",
        filterFn: "salesDate" as FilterFnOption<SoldVehicle>,
        cell: ({ row }) => {
            const saleDate = row.original.soldDate || row.getValue("soldDate") || "";
            return <span>{new Date(saleDate).toLocaleDateString()}</span>;
        },
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
        cell: ({ row }) => <ActionsDropdownMenu vehicle={row.original} />,
    },
];