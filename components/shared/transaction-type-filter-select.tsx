import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  value?: string;
  onChange: (value: string) => void;
}

export function TransactionTypeFilterSelect({
  value = "all",
  onChange,
}: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className="w-full bg-card sm:w-36"
        aria-label="Transaction type"
      >
        <SelectValue placeholder="Type" />
      </SelectTrigger>
      <SelectContent position="popper" side="bottom">
        <SelectItem value="all">All types</SelectItem>
        <SelectItem value="credit">
          <span className="size-1.5 rounded-full bg-success" />
          Credits
        </SelectItem>
        <SelectItem value="debit">
          <span className="size-1.5 rounded-full bg-destructive" />
          Debits
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
