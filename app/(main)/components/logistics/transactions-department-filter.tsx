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
  const departments = useLookupStore.getState().departments;

  return (
    <Select
      onValueChange={(value) => {
        table
          .getColumn("department")
          ?.setFilterValue(value === "all" ? undefined : value);
      }}
    >
      <SelectTrigger className="bg-white">
        <SelectValue placeholder="Department" />
      </SelectTrigger>

      <SelectContent position="popper" side="bottom">
        <SelectItem value="all">All Departments</SelectItem>

        {departments.map((department) => (
          <SelectItem key={department.id} value={department.name}>
            {department.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
