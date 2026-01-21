import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TransactionsTableProps = {
    headers: Headers[];
    data?: any[];
}

type Headers = {
    id: string;
    title?: string;
}

export default function TransactionsTable({ headers, data }: TransactionsTableProps) {
    return (
        <Table className="w-full">
            <TableHeader>
                <TableRow>
                    {headers.map((header) => (
                        <TableHead key={header.id}>{header.title}</TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {data ? data.map((row, index) => (
                    <TableRow key={index}>
                        {headers.map((header) => {
                            let value = row[header.id];

                            // Handle Firestore Timestamp
                            if (value && typeof value === "object" && "seconds" in value && "nanoseconds" in value) {
                                value = new Date(value.seconds * 1000).toLocaleDateString();
                            }

                            return <TableCell key={header.id}>{value}</TableCell>;
                        })}
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={headers.length + 1} className="text-center py-4">
                            No payment records found.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    )
}