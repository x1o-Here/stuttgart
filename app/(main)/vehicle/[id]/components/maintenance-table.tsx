import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { useVehicleContext } from "@/contexts/useVehicleContext";
import AddQuotationDialog from "./add-quotation-dialog";
import EditPaymentDialog from "./edit-payment";
import EditMaintenanceDialog from "./edit-quotation";
import PaymentDeletionDialog from "./payment-deletion-dialog";
import PaymentsTable from "./payments-table";
import QuotationDeletionDialog from "./quotation-deletion-dialog";
import QuotationPaymentsTable from "./quotation-payment-table";

type PaymentsTableProps = {
  data?: any[];
};

const HEADERS = [
  { id: "startDate", title: "Start Date" },
  { id: "endDate", title: "End Date" },
  { id: "description", title: "Description" },
  { id: "amount", title: "Amount" },
  { id: "vendor", title: "Vendor" },
  { id: "status", title: "Status" },
];

const PAYMENT_HEADERS = [
  { id: "date", title: "Date" },
  { id: "amount", title: "Amount" },
  { id: "method", title: "Method" },
  { id: "actions", title: "" },
];

const convertFirestoreTimestamp = (value: any) => {
  if (!value) return "-";
  // Firestore timestamp
  if (value.seconds !== undefined && value.nanoseconds !== undefined) {
    return new Date(value.seconds * 1000).toLocaleDateString();
  }
  // Already a Date
  if (value instanceof Date) return value.toLocaleDateString();

  return value.toString();
};

export default function MaintenanceTable({ data }: PaymentsTableProps) {
  const { vehicle } = useVehicleContext();
  const [openRow, setOpenRow] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setOpenRow((prev) => (prev === id ? null : id));
  };

  return (
    <Table className="w-full">
      <TableHeader>
        <TableRow>
          <TableHead className="w-6" />
          {HEADERS.map((h) => (
            <TableHead key={h.id}>{h.title}</TableHead>
          ))}
          <TableHead className="w-24" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {data?.map((quotation) => {
          const isOpen = openRow === quotation.id;

          return (
            <>
              <TableRow
                key={quotation.id}
                onClick={() => toggleRow(quotation.id)}
                className="cursor-pointer hover:bg-muted"
              >
                {/* Chevron */}
                <TableCell className="w-6">
                  {isOpen ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </TableCell>

                {/* Data columns */}
                {HEADERS.map((header) => {
                  const rawValue = quotation.data?.[header.id];
                  const value = convertFirestoreTimestamp(rawValue);
                  return <TableCell key={header.id}>{value}</TableCell>;
                })}

                <TableCell
                  onClick={(e) => e.stopPropagation()}
                  className="flex gap-2"
                >
                  <EditMaintenanceDialog
                    id={quotation.id}
                    data={quotation.data}
                  />
                  <QuotationDeletionDialog
                    quotationId={quotation.id}
                    vehicleId={vehicle?.id || ""}
                  />
                </TableCell>
              </TableRow>

              {isOpen && (
                <TableRow>
                  <TableCell
                    colSpan={HEADERS.length + 2}
                    className="bg-muted/50 p-4"
                  >
                    <QuotationPaymentsTable
                      headers={PAYMENT_HEADERS}
                      data={quotation.payments}
                      quotationId={quotation.id}
                    />
                  </TableCell>
                </TableRow>
              )}
            </>
          );
        })}

        {/* Add quotation */}
        <TableRow>
          <TableCell colSpan={HEADERS.length + 1} className="text-center p-1">
            <AddQuotationDialog id={vehicle?.id} />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
