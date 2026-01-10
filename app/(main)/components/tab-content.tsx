import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, Plus, SortAsc } from "lucide-react";
import { DataTable } from "./data-table";
import { columns, Vehicle } from "./columns";

async function getData(): Promise<Vehicle[]> {
    return [
        {
            id: "1",
            date: "2023-01-15",
            vehicleNo: "ABC123",
            make: "Toyota",
            yom: 2018,
            pCost: 20000,
            pRemaining: 5000,
            totalCost: 25000,
            sPrice: 27000,
        },
        {
            id: "2",
            date: "2022-11-20",
            vehicleNo: "XYZ789",
            make: "Honda",
            yom: 2019,
            pCost: 22000,
            pRemaining: 4000,
            totalCost: 26000,
            sPrice: 28000,
        }
    ];
}

export default async function TabContent() {
    const data = await getData();

    return (
        <div className="mt-2 p-4 bg-white rounded-md flex flex-col gap-4">
            <div className="border border-dashed rounded-lg w-full flex flex-col gap-2 text-gray-400">
                <div className="w-full flex items-center justify-between gap-4">
                    <Input
                        placeholder="Search..."
                        className="w-full"
                    />

                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Vehicle
                    </Button>
                </div>

                <div className="w-full flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="icon"
                        >
                            <SortAsc />
                        </Button>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                            >
                                <Filter className="mr-2 h-4 w-4" />
                                Purchased Date
                            </Button>

                            <Button
                                variant="outline"
                            >
                                <Filter className="mr-2 h-4 w-4" />
                                Selling Price
                            </Button>
                        </div>
                    </div>

                    <p className="font-light">showing <span className="font-normal">10</span> of <span className="font-normal">100</span></p>
                </div>
            </div>

            <div className="border border-dashed rounded-lg w-full text-gray-400">
                <DataTable columns={columns} data={data} />
            </div>
        </div>
    )
}