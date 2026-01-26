import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import AddPaymentDialog from "./add-payment-dialog";
import EditPaymentDialog from "./edit-payment";
import PaymentDeletionDialog from "./payment-deletion-dialog";

type PaymentsTableProps = {
  id: string;
  headers: Headers[];
  paymentType: "purchase" | "sale";
  data?: any[];
};

type Headers = {
  id: string;
  title?: string;
};

export default function PaymentsTable({
  id,
  paymentType,
  headers,
  data,
}: PaymentsTableProps) {
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
        {data ? (
          data.map((row, index) => (
            <TableRow key={index}>
              {headers.map((header) => {
                let value = row[header.id];

                // Handle Firestore Timestamp
                if (
                  value &&
                  typeof value === "object" &&
                  "seconds" in value &&
                  "nanoseconds" in value
                ) {
                  value = new Date(value.seconds * 1000).toLocaleDateString();
                }

                // Convert account ID to name for 'method'
                if (header.id === "method") {
                  const account = accounts.find((a) => a.id === value);
                  value = account ? account.name : value;
                }

                return <TableCell key={header.id}>{value}</TableCell>;
              })}

              <TableCell className="flex gap-2">
                <EditPaymentDialog
                  referenceId={id}
                  paymentId={row.id}
                  data={row}
                  type={paymentType}
                />
                <PaymentDeletionDialog
                  type={paymentType}
                  vehicleId={id}
                  paymentId={row.id}
                  accountId={row.method}
                  amount={row.amount}
                />
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={headers.length + 1}
              className="text-center py-4"
            >
              No payment records found.
            </TableCell>
          </TableRow>
        )}
        <TableRow>
          <TableCell colSpan={headers.length + 1} className="text-center p-1">
            <AddPaymentDialog referenceId={id} type={paymentType} />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
