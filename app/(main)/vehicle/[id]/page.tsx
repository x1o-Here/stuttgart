"use client";

import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVehicleContext } from "@/contexts/useVehicleContext";
import { db } from "@/lib/firebase/firebase-client";
import { calculateMonthsSincePurchase } from "@/lib/helpers/calculate-months";
import InformationContent from "./components/information-content";
import MaintenanceContent from "./components/maintenance-content";
import PurchasingContent from "./components/purchasing-content";
import SalesContent from "./components/sales-content";

const TABS = [
  { value: "information", label: "Information" },
  { value: "purchase", label: "Purchasing" },
  { value: "sales", label: "Sales" },
  { value: "maintenance", label: "Maintenance" },
];

export default function VehiclePage() {
  const {
    vehicle,
    purchaseDetails,
    purchasePayments,
    salesDetails,
    salesPayments,
    loading,
  } = useVehicleContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 flex items-center justify-center font-sans">
      <div className="w-full min-h-[calc(100vh-2rem)] p-4 bg-zinc-100 rounded-lg overflow-y-auto flex flex-col">
        <div className="mt-2 p-4 bg-white rounded-md flex flex-col gap-4">
          <div className="w-full flex flex-col gap-1 text-gray-400">
            <p className="text-black text-3xl font-semibold">
              {vehicle?.vehicleNo}
            </p>
            <Badge className="bg-green-500">{vehicle?.vehicleStatus}</Badge>
          </div>
        </div>

        <div className="mt-2 p-4 bg-white rounded-md flex flex-col gap-4 flex-1 min-h-0">
          <div className="w-full h-full flex flex-col gap-2 text-gray-400">
            <Tabs defaultValue="information" className="h-full">
              <TabsList className="w-full bg-white p-1 rounded-md gap-x-2">
                {TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="data-[state=active]:bg-zinc-100 data-[state=active]:shadow-none"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="information">
                <InformationContent />
              </TabsContent>
              <TabsContent value="purchase">
                <PurchasingContent />
              </TabsContent>
              <TabsContent value="sales">
                <SalesContent />
              </TabsContent>
              <TabsContent value="maintenance">
                <MaintenanceContent />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
