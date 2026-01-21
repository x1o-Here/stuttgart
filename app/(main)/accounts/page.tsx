'use client'

import { useAccountsContext } from "@/contexts/useAccountsContext";
import AddAccountDialog from "./components/add-account-dialog";
import { useRouter } from "next/navigation";

export default function AccountsPage() {
    const { accounts, loading, error } = useAccountsContext()
    const router = useRouter()

    return (
        <div className="min-h-screen h-full p-4 flex items-center justify-center font-sans">
            <div className="w-full h-full space-y-8 p-4 bg-zinc-100 rounded-lg overflow-y-auto">
                <div className="w-full flex justify-between items-center">
                    <h1 className="text-2xl font-bold mb-4">Accounts</h1>

                    <AddAccountDialog />
                </div>

                <div className="grid grid-cols-3 gap-8">
                    {accounts.map((account) => (
                        <div 
                            key={account.id} 
                            className="mb-2 list-none min-h-32 bg-white rounded shadow"
                            onClick={() => router.push(`/accounts/${account.id}`)}
                        >
                            <div className="h-full flex flex-col items-center justify-center rounded-md">
                                <span className="text-xl font-semibold">LKR {account.balance.toFixed(2)}</span>
                                <span className="font-light">{account.name}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}