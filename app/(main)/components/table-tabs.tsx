'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CircleDot, DiamondPlus, TriangleAlert } from "lucide-react";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { useEffect } from "react";
import { soldColumns } from "./sold-columns";
import { useAllVehiclesContext } from "@/contexts/useAllVehiclesContext";

const TABLE_TABS = [
    { value: "active", label: "Active", icon: CircleDot, color: "text-green-500" },
    // { value: "in-maintenance", label: "In Maintenance", icon: TriangleAlert, color: "text-yellow-500" },
    { value: "sold", label: "Sold", icon: DiamondPlus, color: "text-red-500" }
];

export default function TableTabs() {
    const { vehicles, loading } = useAllVehiclesContext();

    if (loading) {
        return <div>Loading...</div>;
    }

    useEffect(() => {
        console.log("Vehicles in TableTabs:", vehicles);
    }, [vehicles]);

    return (
        <Tabs defaultValue="active">
            <TabsList className="bg-white p-1 rounded-md gap-x-2">
                {TABLE_TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="data-[state=active]:bg-zinc-100 data-[state=active]:shadow-none"
                        >
                            <Icon className={`mr-2 h-4 w-4 ${tab.color}`} />
                            {tab.label}
                        </TabsTrigger>
                    );
                })}
            </TabsList>

            <TabsContent value="active">
                <DataTable
                    columns={columns}
                    data={vehicles
                        .filter(v => v.vehicle?.vehicleStatus === "active")
                        .map(v => ({
                            id: v.id,
                            purchasedDate: v.purchaseDetails?.purchasedDate,
                            vehicleNo: v.vehicle?.vehicleNo,
                            make: v.vehicle?.make,
                            yom: v.vehicle?.yom,
                            pCost: v.purchaseDetails?.purchasedAmount,
                            pRemaining: v.pRemaining,
                            totalCost: v.totalCost,
                            sPrice: v.salesDetails?.salesAmount || v.totalCost,
                            vehicleStatus: v.vehicle?.vehicleStatus,
                        }))
                    }
                />
            </TabsContent>

            {/* <TabsContent value="in-maintenance">
                <DataTable
                    columns={columns}
                    data={data.filter(v => v.vehicleStatus === "in-maintenance")}
                />
            </TabsContent> */}

            <TabsContent value="sold">
                <DataTable
                    columns={soldColumns}
                    data={vehicles
                        .filter(v => v.vehicle?.vehicleStatus === "sold")
                        .map(v => ({
                            id: v.id,
                            soldDate: v.salesDetails?.salesDate,
                            vehicleNo: v.vehicle?.vehicleNo,
                            make: v.vehicle?.make,
                            yom: v.vehicle?.yom,
                            pCost: v.purchaseDetails?.purchasedAmount,
                            totalCost: v.totalCost,
                            sPrice: v.salesDetails?.salesAmount,
                            sRemaining: v.sRemaining,
                            buyerName: v.salesDetails?.buyerName,
                            vehicleStatus: v.vehicle?.vehicleStatus,
                        }))
                    }
                />
            </TabsContent>
        </Tabs>
    )
}
