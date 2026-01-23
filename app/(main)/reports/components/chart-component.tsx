"use client";

import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import { useState } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useSelectedMonth } from "@/hooks/use-selected-month";

type DailyData = {
    date: number;
    revenue: number;
    profit: number;
};

type MonthlyData = {
    month: string;
    year: number;
    daily: DailyData[];
};

type ChartMetric = "revenue" | "profit";

type ChartComponentProps = {
    existingData: MonthlyData[];
};

type MonthlyChartData = {
    month: string;
    year: number;
    revenue: number;
    profit: number;
};

export default function ChartComponent({ existingData }: ChartComponentProps) {
    const { setSelectedMonth } = useSelectedMonth();

    const [selectedYear, setSelectedYear] = useState<number>(
        new Date().getFullYear()
    );
    const [selectedMetric, setSelectedMetric] =
        useState<ChartMetric>("revenue");
    const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

    const allMonths = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

    const years = (() => {
        if (!existingData || existingData.length === 0) return [new Date().getFullYear()];
        const minYear = Math.min(...existingData.map(d => d.year));
        const maxYear = new Date().getFullYear();
        return Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
    })();

    const filteredData = existingData.filter(
        (data) => data.year === selectedYear
    );

    const calculateMonthlyData = (month: string): MonthlyChartData => {
        const monthData = filteredData.find((data) => data.month === month);

        const monthlyRevenue =
            monthData?.daily.reduce((acc, day) => acc + day.revenue, 0) ?? 0;

        const monthlyProfit =
            monthData?.daily.reduce((acc, day) => acc + day.profit, 0) ?? 0;

        return {
            month,
            year: selectedYear,
            revenue: monthlyRevenue,
            profit: monthlyProfit,
        };
    };

    const chartData: MonthlyChartData[] = allMonths.map((month) =>
        calculateMonthlyData(month)
    );

    const getDaysInMonth = (month: string, year: number): number => {
        const monthIndex = allMonths.indexOf(month);
        return new Date(year, monthIndex + 1, 0).getDate();
    };

    const getDailyData = (month: string): DailyData[] => {
        const monthData = filteredData.find((data) => data.month === month);
        const daysInMonth = getDaysInMonth(month, selectedYear);

        return Array.from({ length: daysInMonth }, (_, i) => {
            const existingDay = monthData?.daily.find(
                (day) => day.date === i + 1
            );

            return (
                existingDay ?? {
                    date: i + 1,
                    revenue: 0,
                    profit: 0,
                }
            );
        });
    };

    const chartConfig: Record<
        ChartMetric,
        { label: string; color: string }
    > = {
        revenue: {
            label: "Revenue",
            color: "#60a5fa",
        },
        profit: {
            label: "Profit",
            color: "#8884d8",
        },
    };

    const handleBarClick = (payload?: MonthlyChartData) => {
        if (!payload) return;

        setSelectedMonth(payload.month, payload.year);

        setExpandedMonth((prev) =>
            prev === payload.month ? null : payload.month
        );
    };

    return (
        <div className="h-full w-full flex flex-col items-center gap-4">
            {/* Controls */}
            <div className="flex flex-row-reverse gap-2">
                <Select
                    value={selectedMetric}
                    onValueChange={(value) =>
                        setSelectedMetric(value as ChartMetric)
                    }
                >
                    <SelectTrigger className="w-full border border-gray-300 rounded-md">
                        <SelectValue placeholder="Metric" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.keys(chartConfig).map((metric) => (
                            <SelectItem key={metric} value={metric}>
                                {chartConfig[metric as ChartMetric].label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={selectedYear.toString()}
                    onValueChange={(value) =>
                        setSelectedYear(Number(value))
                    }
                >
                    <SelectTrigger className="w-full border border-gray-300 rounded-md">
                        <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                        {years.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                                {year}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Chart */}
            <ChartContainer config={chartConfig} className="w-full mt-8">
                <BarChart
                    accessibilityLayer
                    data={
                        expandedMonth
                            ? getDailyData(expandedMonth)
                            : chartData
                    }
                    onClick={(e) =>
                        handleBarClick(
                            e?.activePayload?.[0]?.payload as MonthlyChartData
                        )
                    }
                    className="overflow-visible"
                >
                    <XAxis
                        dataKey={expandedMonth ? "date" : "month"}
                        tickLine={true}
                        tickMargin={10}
                        axisLine={false}
                        tickFormatter={(value: string | number) =>
                            expandedMonth
                                ? value.toString()
                                : value.toString().slice(0, 3)
                        }
                    />
                    <YAxis
                        tickLine={true}
                        axisLine={false}
                        tickMargin={10}
                        width={120}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                        dataKey={selectedMetric}
                        fill={chartConfig[selectedMetric].color}
                        radius={4}
                    />
                </BarChart>
            </ChartContainer>
        </div>
    );
}
