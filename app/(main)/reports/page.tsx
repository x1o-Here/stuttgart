'use client'

import { useEffect } from "react";
import ChartComponent from "./components/chart-component";
import { useSelectedMonth } from "@/hooks/use-selected-month";
import { toDate } from "@/lib/helpers/to-date";
import { useAllVehiclesContext } from "@/contexts/useAllVehiclesContext";

const allMonths = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

function buildReportData(vehicles: any[]) {
    const map = new Map<string, any>();

    vehicles.forEach((v) => {
        const sales = v.salesDetails;
        if (!sales?.salesDate) return;

        const soldDate = toDate(sales.salesDate);
        if (!soldDate) return;

        const year = soldDate.getFullYear();
        const month = allMonths[soldDate.getMonth()];
        const day = soldDate.getDate();

        const key = `${year}-${month}`;

        if (!map.has(key)) {
            map.set(key, {
                year,
                month,
                daily: [],
                totalPayables: 0,
                totalRecievables: 0,
                totalSales: 0,
            });
        }

        const bucket = map.get(key);

        const existingDay = bucket.daily.find((d: { date: number }) => d.date === day);

        if (existingDay) {
            existingDay.revenue += sales.salesAmount || 0;
            existingDay.profit += sales.pnl || 0;
        } else {
            bucket.daily.push({
                date: day,
                revenue: sales.salesAmount || 0,
                profit: sales.pnl || 0,
            });
        }

        bucket.totalSales += 1;
        bucket.totalPayables += v.pRemaining || 0;
        bucket.totalRecievables += v.sRemaining || 0;
    });

    return Array.from(map.values()).map((month) => ({
        ...month,
        daily: month.daily.sort((a: any, b: any) => a.date - b.date),
    }));
}


export default function Reports() {
    const { vehicles, loading } = useAllVehiclesContext();
    const reportData = buildReportData(vehicles);

    useEffect(() => {
        console.log("Vehicles:", vehicles);
        console.log("Report Data:", reportData);
    }, [vehicles]);

    const { selectedMonth, selectedYear } = useSelectedMonth();

    const currentMonth = selectedMonth || new Date().toLocaleString('default', { month: 'short' });
    const currentYear = selectedYear || new Date().getFullYear();

    const currentMonthData: { totalPayables?: number; totalRecievables?: number; totalSales?: number } = reportData?.find(
        (item: { month: string; year: number }) => item.year === currentYear && item.month === currentMonth
    ) || { totalPayables: 0, totalRecievables: 0, totalSales: 0 };

    return (
        <div className="h-screen p-4 flex items-center justify-center">
            <div className="w-full h-full space-y-8 p-4 bg-zinc-100 rounded-lg grid grid-cols-4">
                <div className="col-span-3">
                    <ChartComponent existingData={reportData} />
                </div>

                <div className="h-full p-5 grid grid-rows-3 gap-y-5 text-center">
                    <div className="w-full border border-gray-300 rounded-md flex flex-col items-center justify-center">
                        <p className="text-4xl font-medium">LKR {currentMonthData?.totalPayables || 0}</p>
                        <p className="text-xl font-light">Total Outstanding</p>
                        <p className="text-sm text-gray-300">{currentMonth} {currentYear}</p>
                    </div>
                    <div className="w-full border border-gray-300 rounded-md flex flex-col items-center justify-center">
                        <p className="text-4xl font-medium">LKR {currentMonthData?.totalRecievables || 0}</p>
                        <p className="text-xl font-light">Total Due</p>
                        <p className="text-sm text-gray-300">{currentMonth} {currentYear}</p>
                    </div>
                    <div className="w-full border border-gray-300 rounded-md flex flex-col items-center justify-center">
                        <p className="text-4xl font-medium">{currentMonthData?.totalSales || 0}</p>
                        <p className="text-xl font-light">Total Sales</p>
                        <p className="text-sm text-gray-300">{currentMonth} {currentYear}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}