import type { Table } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLookupStore } from "@/stores/use-lookup-store";

interface TransactionsDepartmentFilterProps<TData> {
  table: Table<TData>;
}

export default function TransactionsDepartmentFilter<TData>({
  table,
}: TransactionsDepartmentFilterProps<TData>) {
  const departments = useLookupStore((s) => s.departments);

  return (
    <Select
      onValueChange={(value) => {
        table
          .getColumn("department")
          ?.setFilterValue(value === "all" ? undefined : value);
      }}
    >
      <SelectTrigger className="w-full bg-card sm:w-44" aria-label="Department">
        <SelectValue placeholder="Department" />
      </SelectTrigger>

      <SelectContent position="popper" side="bottom">
        <SelectItem value="all">All departments</SelectItem>

        {departments.map((department) => (
          <SelectItem key={department.id} value={department.name}>
            {department.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
