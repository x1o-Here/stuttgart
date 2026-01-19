'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CircleDot, DiamondPlus, TriangleAlert } from "lucide-react";
import { DataTable } from "./data-table";
import { columns, Vehicle } from "./columns";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/firebase-client"
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { soldColumns } from "./sold-columns";

const TABLE_TABS = [
    { value: "active", label: "Active", icon: CircleDot, color: "text-green-500" },
    // { value: "in-maintenance", label: "In Maintenance", icon: TriangleAlert, color: "text-yellow-500" },
    { value: "sold", label: "Sold", icon: DiamondPlus, color: "text-red-500" }
];

export default function TableTabs() {
    const [data, setData] = useState<Vehicle[]>([]);

    useEffect(() => {
        // Real-time listener for vehicles collection
        const vehiclesCol = collection(db, "vehicles")
        const q = query(vehiclesCol, where("entityStatus", "==", true))

        const unsubscribe = onSnapshot(q, async (vehicleSnap) => {
            const vehiclesData: Vehicle[] = []

            for (const vehicleDoc of vehicleSnap.docs) {
                const vehicle = vehicleDoc.data() as any
                const id = vehicleDoc.id

                // Fetch corresponding purchaseDetails
                const purchaseSnap = await getDoc(doc(db, "purchaseDetails", id))
                const purchaseData = purchaseSnap.exists() ? purchaseSnap.data() : {}

                // Fetch purchasePayments subcollection
                const paymentsCol = collection(db, "purchaseDetails", id, "purchasePayment")
                const paymentsSnap = await getDocs(paymentsCol)
                const totalPaid = paymentsSnap.docs.reduce((sum, doc) => {
                    const payment = doc.data()
                    return sum + (payment.amount || 0)
                }, 0)

                const pCost = purchaseData?.purchasedAmount || 0
                const pRemaining = Math.max(0, pCost - totalPaid)

                // Calculate months since purchase
                const purchasedDate = purchaseData?.purchasedDate
                    ? purchaseData.purchasedDate.toDate
                        ? purchaseData.purchasedDate.toDate()
                        : new Date(purchaseData.purchasedDate)
                    : new Date()

                const now = new Date()
                const yearsDiff = now.getFullYear() - purchasedDate.getFullYear()
                const monthsDiff = now.getMonth() - purchasedDate.getMonth()
                const totalMonths = yearsDiff * 12 + monthsDiff

                // Calculate COC = 1% of pCost * months
                const COC = (pCost * 0.01) * totalMonths
                const totalCost = pCost + COC

                // Fetch corresponding salesDetails
                const salesSnap = await getDoc(doc(db, "salesDetails", id))
                const salesData = salesSnap.exists() ? salesSnap.data() : {}

                vehiclesData.push({
                    id,
                    purchasedDate: purchaseData?.purchasedDate
                        ? (purchaseData.purchasedDate.toDate
                            ? purchaseData.purchasedDate.toDate().toISOString() // Firestore Timestamp
                            : new Date(purchaseData.purchasedDate).toISOString() // string fallback
                        )
                        : "",
                    vehicleNo: vehicle.vehicleNo,
                    make: vehicle.make,
                    yom: vehicle.yom,
                    pCost,
                    pRemaining,
                    totalCost,
                    sPrice: salesData?.salesAmount || totalCost || 0,
                    vehicleStatus: vehicle.vehicleStatus,
                    soldDate: salesData?.salesDate
                        ? salesData.salesDate.toDate
                            ? salesData.salesDate.toDate().toISOString()
                            : new Date(salesData.salesDate).toISOString()
                        : "",
                    buyerName: salesData?.buyerName || "",
                })
            }

            setData(vehiclesData)
        })

        return () => unsubscribe()
    }, [])

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
                    data={data.filter(v => v.vehicleStatus === "active")}
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
                    data={data
                        .filter(v => v.vehicleStatus === "sold")
                        .map(v => ({
                            ...v,
                            soldDate: v.soldDate || "",
                            buyerName: v.buyerName,
                        }))
                    }
                />
            </TabsContent>
        </Tabs>
    )
}
