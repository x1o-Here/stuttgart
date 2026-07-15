import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLookupStore } from "@/stores/use-lookup-store";
import { Table } from "@tanstack/react-table";

interface TransactionsVehicleFilterProps<TData> {
    table: Table<TData>;
}

export default function TransactionsVehicleFilter<TData>({
    table
}: TransactionsVehicleFilterProps<TData>) {
    const vehicles = useLookupStore.getState().vehicles;

    return (
        <Select
            onValueChange={(value) => {
                table
                    .getColumn("vehicle")
                    ?.setFilterValue(value === "all" ? undefined : value);
            }}
        >
            <SelectTrigger className="bg-white">
                <SelectValue placeholder="Vehicle" />
            </SelectTrigger>

            <SelectContent
                position="popper"
                side="bottom"
            >
                <SelectItem value="all">
                    All Vehicles
                </SelectItem>

                {vehicles.map((vehicle) => (
                    <SelectItem
                        key={vehicle.id}
                        value={vehicle.name}
                    >
                        {vehicle.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}