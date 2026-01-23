"use client"

import { useState, useCallback } from "react";

export type SelectedMonthState = {
    selectedMonth: string;
    selectedYear: number;
    setSelectedMonth: (month: string, year: number) => void;
};

export function useSelectedMonth(): SelectedMonthState {
    const [selectedMonth, setMonth] = useState<string>(
        new Date().toLocaleString("default", { month: "long" })
    );
    const [selectedYear, setYear] = useState<number>(
        new Date().getFullYear()
    );

    const setSelectedMonth = useCallback((month: string, year: number) => {
        setMonth(month);
        setYear(year);
    }, []);

    return {
        selectedMonth,
        selectedYear,
        setSelectedMonth,
    };
}
