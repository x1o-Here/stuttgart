import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CircleDot, DiamondPlus, TriangleAlert } from "lucide-react";
import TabContent from "./tab-content";

const TABLE_TABS = [
    { value: "active", label: "Active", icon: CircleDot, color: "text-green-500" },
    { value: "in-maintenance", label: "In Maintenance", icon: TriangleAlert, color: "text-yellow-500" },
    { value: "sold", label: "Sold", icon: DiamondPlus, color: "text-red-500" }
];

export default function TableTabs() {
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
                <TabContent />
            </TabsContent>

            <TabsContent value="in-maintenance">
                In Maintenance Content
            </TabsContent>

            <TabsContent value="sold">
                Sold Content
            </TabsContent>
        </Tabs>
    )
}