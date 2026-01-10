import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InformationContent from "./components/information-content";
import PurchasingContent from "./components/purchasing-content";
import SalesContent from "./components/sales-content";
import MaintenanceContent from "./components/maintenance-content";

type Props = {
    params: {
        id: string;
    };
};

const TABS = [
    { value: "information", label: "Information" },
    { value: "purchase", label: "Purchasing" },
    { value: "sales", label: "Sales" },
    { value: "maintenance", label: "Maintenance" },
];

export default async function VehiclePage({ params }: Props) {
    const { id } = await params;

    return (
        <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
            <div className="w-full h-full p-4 bg-zinc-100 rounded-lg overflow-y-auto">
                <div className="mt-2 p-4 bg-white rounded-md flex flex-col gap-4">
                    <div className="border border-dashed rounded-lg w-full flex flex-col gap-2 text-gray-400">
                        <p>Vehicle ID: {id}</p>
                    </div>
                </div>

                <div className="mt-2 p-4 h-[90%] bg-white rounded-md flex flex-col gap-4">
                    <div className="border border-dashed rounded-lg w-full h-full flex flex-col gap-2 text-gray-400">
                        <Tabs defaultValue="information">
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
