'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import {
    collection,
    doc,
    onSnapshot,
    query,
    where
} from "firebase/firestore"
import { db } from "@/lib/firebase/firebase-client"
import { calculateMonthsSincePurchase } from "@/lib/helpers/calculate-months"

// Helpers
function calculateRemaining(total: number, payments: any[]) {
    if (!total) return 0
    const paid = payments?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0
    return Math.max(total - paid, 0)
}

function calculateTotalCost(pCost: number, months: number, quotationTotal: number) {
    const COC = (pCost * 0.01) * months
    return pCost + COC + quotationTotal
}

// Types
export interface EnrichedVehicle {
    id: string
    vehicle: any
    purchaseDetails: any | null
    purchasePayments: any[]
    salesDetails: any | null
    salesPayments: any[]
    quotations: any[]
    pRemaining: number
    sRemaining: number
    totalCost: number
    loading: boolean
}

interface AllVehiclesContextType {
    vehicles: EnrichedVehicle[]
    loading: boolean
}

// Context
const AllVehiclesContext = createContext<AllVehiclesContextType>({
    vehicles: [],
    loading: true
})

export function useAllVehiclesContext() {
    return useContext(AllVehiclesContext)
}

// Provider
export function AllVehiclesProvider({ children }: { children: ReactNode }) {
    const [vehicles, setVehicles] = useState<EnrichedVehicle[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)

        const vehiclesQuery = query(
            collection(db, "vehicles"),
            where("entityStatus", "==", true)
        )

        const vehicleMap = new Map<string, EnrichedVehicle>() // id -> vehicle
        const unsubscribers: (() => void)[] = []

        const unsubVehicles = onSnapshot(vehiclesQuery, (snap) => {
            snap.docChanges().forEach((vehicleDoc) => {
                const vehicleId = vehicleDoc.doc.id
                const vehicleData = vehicleDoc.doc.data()

                const updateVehicle = (updates: Partial<EnrichedVehicle>) => {
                    const prev = vehicleMap.get(vehicleId)!
                    vehicleMap.set(vehicleId, { ...prev, ...updates })
                    setVehicles(Array.from(vehicleMap.values()))
                }

                if (vehicleDoc.type === "added" || vehicleDoc.type === "modified") {
                    // Add or update vehicle
                    const prev = vehicleMap.get(vehicleId)
                    const enrichedVehicle: EnrichedVehicle = {
                        id: vehicleId,
                        vehicle: { ...vehicleData, id: vehicleId },
                        purchaseDetails: prev?.purchaseDetails || null,
                        purchasePayments: prev?.purchasePayments || [],
                        salesDetails: prev?.salesDetails || null,
                        salesPayments: prev?.salesPayments || [],
                        quotations: prev?.quotations || [],
                        pRemaining: prev?.pRemaining || 0,
                        sRemaining: prev?.sRemaining || 0,
                        totalCost: prev?.totalCost || 0,
                        loading: false,
                    }

                    vehicleMap.set(vehicleId, enrichedVehicle)

                    // ------------------
                    // Purchase Details
                    const purchaseDocRef = doc(db, "purchaseDetails", vehicleId)
                    unsubscribers.push(
                        onSnapshot(purchaseDocRef, (snap) => {
                            const purchaseDetails = snap.exists() ? snap.data() : null
                            updateVehicle({ purchaseDetails })
                            recalcTotalCost(vehicleId)
                        })
                    )


                    // Purchase Payments
                    const purchasePaymentsCol = collection(db, "purchaseDetails", vehicleId, "purchasePayments")
                    unsubscribers.push(
                        onSnapshot(purchasePaymentsCol, (snap) => {
                            const payments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                            const v = vehicleMap.get(vehicleId)!
                            const pTotal = v.purchaseDetails?.purchasedAmount || 0
                            updateVehicle({ purchasePayments: payments, pRemaining: calculateRemaining(pTotal, payments) })
                        })
                    )

                    // Sales Details
                    const salesDocRef = doc(db, "salesDetails", vehicleId)
                    unsubscribers.push(
                        onSnapshot(salesDocRef, (snap) => {
                            const salesDetails = snap.exists() ? snap.data() : null
                            updateVehicle({ salesDetails })
                            recalcTotalCost(vehicleId)
                        })
                    )

                    // Sales Payments
                    const salesPaymentsCol = collection(db, "salesDetails", vehicleId, "salesPayments")
                    unsubscribers.push(
                        onSnapshot(salesPaymentsCol, (snap) => {
                            const payments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                            const v = vehicleMap.get(vehicleId)!
                            const sTotal = v.salesDetails?.salesAmount || 0
                            updateVehicle({ salesPayments: payments, sRemaining: calculateRemaining(sTotal, payments) })
                        })
                    )

                    // Quotations
                    const quotationsCol = collection(db, "quotations")
                    unsubscribers.push(
                        onSnapshot(quotationsCol, (snap) => {
                            const vehicleQuotations = snap.docs
                                .filter(doc => doc.data().vehicleId === vehicleId)
                                .map(doc => ({ id: doc.id, data: doc.data(), payments: [] }))
                            updateVehicle({ quotations: vehicleQuotations })

                            // Listen to quotation payments
                            vehicleQuotations.forEach(q => {
                                const paymentsCol = collection(db, "quotations", q.id, "quotationPayments")
                                const unsub = onSnapshot(paymentsCol, paySnap => {
                                    const payments = paySnap.docs.map(d => ({ id: d.id, ...d.data() }))
                                    const v = vehicleMap.get(vehicleId)!
                                    updateVehicle({
                                        quotations: v.quotations.map(quote =>
                                            quote.id === q.id ? { ...quote, payments } : quote
                                        )
                                    })
                                    recalcTotalCost(vehicleId)
                                })
                                unsubscribers.push(unsub)
                            })

                            recalcTotalCost(vehicleId)
                        })
                    )
                } else if (vehicleDoc.type === "removed") {
                    // Remove vehicle from local map
                    vehicleMap.delete(vehicleId)
                    setVehicles(Array.from(vehicleMap.values()))
                }

                const recalcTotalCost = (vehicleId: string) => {
                    const v = vehicleMap.get(vehicleId)!
                    if (!v.purchaseDetails) return

                    const months = calculateMonthsSincePurchase(
                        v.purchaseDetails.purchasedDate,
                        v.salesDetails?.salesDate || undefined
                    )
                    const pCost = v.purchaseDetails?.purchasedAmount || 0
                    const totalQuotationAmount = v.quotations?.reduce(
                        (acc, q) => acc + (q.data.amount || 0),
                        0
                    ) || 0

                    const totalCost = calculateTotalCost(pCost, months, totalQuotationAmount)
                    updateVehicle({ totalCost })
                }
            })

            setLoading(false)
        })

        return () => {
            unsubVehicles()
            unsubscribers.forEach(u => u())
        }
    }, [])

    return (
        <AllVehiclesContext.Provider value={{ vehicles, loading }}>
            {children}
        </AllVehiclesContext.Provider>
    )
}
