'use client'

import { useAccountsContext } from "@/contexts/useAccountsContext";
import AddAccountDialog from "./components/add-account-dialog";

export default function AccountsPage() {
    const { accounts, loading, error } = useAccountsContext()
    return (
        <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
            <div className="w-full h-full space-y-8 p-4 bg-zinc-100 rounded-lg overflow-y-auto">
                <div className="w-full flex justify-between items-center">
                    <h1 className="text-2xl font-bold mb-4">Accounts</h1>

                    <AddAccountDialog />
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <ul>
                        {accounts.map((account) => (
                            <li key={account.id} className="mb-2 p-4 bg-white rounded shadow">
                                <div className="flex justify-between">
                                    <span className="font-medium">{account.name}</span>
                                    <span className="font-semibold">LKR {account.balance.toFixed(2)}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    )
}