'use client'

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase/firebase-client"
import { collection, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore"

export type Account = {
    id: string
    name: string
    createdAt?: Date
    [key: string]: any
}

export function useAccounts() {
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setLoading(true)
        setError(null)

        try {
            const q = query(collection(db, "accounts"), orderBy("createdAt", "desc"))
            const unsubscribe = onSnapshot(
                q,
                (snapshot) => {
                    const data: Account[] = snapshot.docs.map((doc) => {
                        const docData = doc.data() as any

                        return {
                            id: doc.id,
                            name: docData.name || "Unnamed Account", // fallback for missing name
                            ...docData,
                            createdAt: docData.createdAt instanceof Timestamp
                                ? docData.createdAt.toDate()
                                : docData.createdAt
                        }
                    })
                    setAccounts(data)
                    setLoading(false)
                },
                (err) => {
                    console.error("Failed to fetch accounts:", err)
                    setError("Failed to fetch accounts")
                    setLoading(false)
                }
            )

            return () => unsubscribe()
        } catch (err) {
            console.error(err)
            setError("Unexpected error")
            setLoading(false)
        }
    }, [])

    return { accounts, loading, error }
}
