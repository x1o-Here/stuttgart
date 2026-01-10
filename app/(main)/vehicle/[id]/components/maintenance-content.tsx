import PaymentsTable from "./payments-table";

const paymentHeaders = [
    { id: "start-date", title: "Start Date" },
    { id: "end-date", title: "End Date" },
    { id: "description", title: "Description" },
    { id: "amount", title: "Amount" },
    { id: "vendor", title: "Vendor" },
    { id: "status", title: "Status" },
    { id: "actions", title: "" },
];

export default function MaintenanceContent() {
    return (
        <div className="p-4">
            <PaymentsTable
                headers={paymentHeaders}
                data={[
                    {
                        "start-date": "2023-01-01",
                        "end-date": "2023-01-02",
                        "description": "Oil Change",
                        "amount": "LKR 15000",
                        "vendor": "AutoCare",
                        "status": "Completed"
                    },
                    {
                        "start-date": "2023-03-15",
                        "end-date": "pending",
                        "description": "Tire Rotation",
                        "amount": "LKR 8000",
                        "vendor": "TireShop",
                        "status": "Pending"
                    }
                ]}
            />

        </div>
    )
}