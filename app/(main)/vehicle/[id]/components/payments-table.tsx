import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Delete, Edit } from "lucide-react";

type PaymentsTableProps = {
    headers: Headers[];
    data?: any[];
}

type Headers = {
    id: string;
    title?: string;
}

export default function PaymentsTable({ headers, data }: PaymentsTableProps) {
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
                        {headers.map((header) => (
                            <TableCell key={header.id}>{row[header.id]}</TableCell>
                        ))}
                        <TableCell className="flex gap-2">
                            <Button variant="outline" size="icon-sm"><Edit /></Button>
                            <Button variant="outline" size="icon-sm"><Delete /></Button>
                        </TableCell>
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={headers.length + 1} className="text-center py-4">
                            No payment records found.
                        </TableCell>
                    </TableRow>
                )}
                <TableRow>
                    <TableCell colSpan={headers.length + 1} className="text-center p-1">
                        <Button variant="ghost" size="sm" className="w-full">Add Record</Button>
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    )
}