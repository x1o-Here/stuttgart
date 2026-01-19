'use client'

import { Account, useAccounts } from "@/hooks/use-accounts"
import { createContext, useContext, ReactNode } from "react"

interface AccountsContextValue {
    accounts: Account[]
    loading: boolean
    error: string | null
}

const AccountsContext = createContext<AccountsContextValue | undefined>(undefined)

export function AccountsProvider({ children }: { children: ReactNode }) {
    const { accounts, loading, error } = useAccounts()

    return (
        <AccountsContext.Provider value={{ accounts, loading, error }}>
            {children}
        </AccountsContext.Provider>
    )
}

export function useAccountsContext() {
    const context = useContext(AccountsContext)
    if (!context) {
        throw new Error("useAccountsContext must be used within AccountsProvider")
    }
    return context
}
