"use client";

import { Filter } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";

interface SellingPriceFilterPopoverProps {
  min: number;
  max: number;
  onChange: (range: { min: number; max: number }) => void;
}

export function SellingPriceFilterPopover({
  min,
  max,
  onChange,
}: SellingPriceFilterPopoverProps) {
  const [value, setValue] = useState<number[]>([min, max]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Selling Price
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-4 flex flex-col gap-4">
        <div className="flex justify-between text-sm font-medium">
          <span>{value[0]}</span>
          <span>{value[1]}</span>
        </div>

        <Slider
          value={value}
          onValueChange={setValue}
          min={min}
          max={max}
          step={100000}
        />

        <Button
          className="mt-2"
          onClick={() => onChange({ min: value[0], max: value[1] })}
        >
          Apply
        </Button>
      </PopoverContent>
    </Popover>
  );
}
