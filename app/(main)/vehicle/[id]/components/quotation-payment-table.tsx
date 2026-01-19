import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AddPaymentDialog from "./add-payment-dialog";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import PaymentDeletionDialog from "./payment-deletion-dialog";
import EditPaymentDialog from "./edit-payment";

type PaymentsTableProps = {
    headers: Headers[];
    data?: any[];
}

type Headers = {
    id: string;
    title?: string;
}

export default function QuotationPaymentsTable({ headers, data }: PaymentsTableProps) {
    const { accounts } = useAccountsContext();

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

                            // Convert account ID to name for 'method'
                            if (header.id === "method") {
                                const account = accounts.find(a => a.id === value);
                                value = account ? account.name : value;
                            }

                            return <TableCell key={header.id}>{value}</TableCell>;
                        })}

                        <TableCell className="flex gap-2">
                            <EditPaymentDialog id={id} data={row} />
                            <PaymentDeletionDialog 
                                vehicleId={id} 
                                paymentId={row.id} 
                                accountId={row.accountId}
                                amount={row.amount}
                            />
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
                        {/* <AddPaymentDialog id={id} /> */}
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    )
}