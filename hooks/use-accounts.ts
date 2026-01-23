'use client'

import { useEffect, useRef, useState } from "react"
import { db } from "@/lib/firebase/firebase-client"
import {
    collection,
    onSnapshot,
    orderBy,
    query,
    Timestamp,
} from "firebase/firestore"

export type Transaction = {
    id: string
    date: Date
    description: string
    amount: number
    type: "debit" | "credit"
}

export type Account = {
    id: string
    name: string
    balance: number
    transactions: Transaction[]
    createdAt?: Date
}

export function useAccounts() {
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Keep transaction unsubscribers per account
    const transactionUnsubs = useRef<Record<string, () => void>>({})

    useEffect(() => {
        setLoading(true)
        setError(null)

        const accountsQuery = query(
            collection(db, "accounts"),
            orderBy("createdAt", "desc")
        )

        const unsubscribeAccounts = onSnapshot(
            accountsQuery,
            (snapshot) => {
                setAccounts((prev) => {
                    const accountMap = new Map(prev.map(a => [a.id, a]))

                    snapshot.docChanges().forEach((change) => {
                        const id = change.doc.id
                        const data = change.doc.data() as any

                        if (change.type === "removed") {
                            accountMap.delete(id)

                            // cleanup transaction listener
                            transactionUnsubs.current[id]?.()
                            delete transactionUnsubs.current[id]
                            return
                        }

                        const account: Account = {
                            id,
                            name: data.name || "Unnamed Account",
                            balance: data.balance || 0,
                            transactions: accountMap.get(id)?.transactions || [],
                            createdAt:
                                data.createdAt instanceof Timestamp
                                    ? data.createdAt.toDate()
                                    : data.createdAt,
                        }

                        accountMap.set(id, account)

                        // 🔁 Attach transaction listener once per account
                        if (!transactionUnsubs.current[id]) {
                            const txQuery = query(
                                collection(db, "accounts", id, "transactions"),
                                orderBy("date", "desc")
                            )

                            transactionUnsubs.current[id] = onSnapshot(
                                txQuery,
                                (txSnap) => {
                                    const transactions: Transaction[] = txSnap.docs.map(tx => {
                                        const t = tx.data() as any
                                        return {
                                            id: tx.id,
                                            description: t.description || "",
                                            amount: t.amount || 0,
                                            type: t.type,
                                            date:
                                                t.date instanceof Timestamp
                                                    ? t.date.toDate()
                                                    : t.date,
                                        }
                                    })

                                    setAccounts((current) =>
                                        current.map(acc =>
                                            acc.id === id
                                                ? { ...acc, transactions }
                                                : acc
                                        )
                                    )
                                }
                            )
                        }
                    })

                    setLoading(false)
                    return Array.from(accountMap.values())
                })
            },
            (err) => {
                console.error("Failed to fetch accounts:", err)
                setError("Failed to fetch accounts")
                setLoading(false)
            }
        )

        return () => {
            unsubscribeAccounts()
            Object.values(transactionUnsubs.current).forEach(unsub => unsub())
            transactionUnsubs.current = {}
        }
    }, [])

    return { accounts, loading, error }
}
