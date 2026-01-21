'use client'

import { useAccountsContext } from "@/contexts/useAccountsContext"
import { useParams } from "next/navigation"
import TransactionsTable from "./components/transactions-table"
import { useEffect } from "react"

export default function AccountPage() {
    const params = useParams()
    const { id } = params

    const { accounts } = useAccountsContext()
    const account = accounts.find(acc => acc.id === id)

    useEffect(() => {
        console.log("Account details:", account);
    }, [account]);

    return (
        <div className="min-h-screen p-4 flex items-center justify-center font-sans">
            <div className="w-full min-h-[calc(100vh-2rem)] p-4 bg-zinc-100 rounded-lg overflow-y-auto flex flex-col">
                <div className="mt-2 p-4 bg-white rounded-md flex items-center justify-between gap-4">
                    <p className="text-black text-3xl font-semibold">{account?.name}</p>
                    <p className="text-black text-xl font-light">LKR {account?.balance}</p>
                </div>

                <div className="mt-2 p-4 bg-white rounded-md flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
                    <TransactionsTable
                        headers={[
                            { id: "type", title: "" },
                            { id: "date", title: "Date" },
                            { id: "description", title: "Description" },
                            { id: "amount", title: "Amount" },
                        ]}
                        data={account?.transactions || []}
                    />
                </div>
            </div>
        </div>
    )
}