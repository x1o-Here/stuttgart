'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { onSnapshot, doc, collection } from "firebase/firestore"
import { db } from "@/lib/firebase/firebase-client"
import { calculateMonthsSincePurchase } from "@/lib/helpers/calculate-months"

// Utility to calculate remaining
function calculateRemaining(total: number, payments: any[]) {
    if (!total) return 0
    const paid = payments?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0
    return Math.max(total - paid, 0)
}

// Utility to calculate total cost
function calculateTotalCost(pCost: number, months: number) {
    if (!pCost || !months) return 0
    const COC = (pCost * 0.01) * months
    return pCost + COC
}

interface Quotation {
    id: string
    data: any
    payments: any[]
}

interface VehicleContextType {
    vehicle: any | null
    purchaseDetails: any | null
    purchasePayments: any[]
    salesDetails: any | null
    salesPayments: any[]
    quotations: Quotation[]
    pRemaining: number
    sRemaining: number
    totalCost: number
    loading: boolean
}

const VehicleContext = createContext<VehicleContextType>({
    vehicle: null,
    purchaseDetails: null,
    purchasePayments: [],
    salesDetails: null,
    salesPayments: [],
    quotations: [],
    pRemaining: 0,
    sRemaining: 0,
    totalCost: 0,
    loading: true,
})

export function useVehicleContext() {
    return useContext(VehicleContext)
}

export function VehicleProvider({ children, vehicleId }: { children: ReactNode; vehicleId: string }) {
    const [vehicle, setVehicle] = useState<any>(null)
    const [purchaseDetails, setPurchaseDetails] = useState<any>(null)
    const [purchasePayments, setPurchasePayments] = useState<any[]>([])
    const [salesDetails, setSalesDetails] = useState<any>(null)
    const [salesPayments, setSalesPayments] = useState<any[]>([])
    const [quotations, setQuotations] = useState<Quotation[]>([])
    const [loading, setLoading] = useState(true)
    const [pRemaining, setPRemaining] = useState(0)
    const [sRemaining, setSRemaining] = useState(0)
    const [totalCost, setTotalCost] = useState(0)

    useEffect(() => {
        if (!vehicleId) return
        setLoading(true)

        // Vehicle document
        const vehicleDocRef = doc(db, "vehicles", vehicleId)
        const unsubscribeVehicle = onSnapshot(vehicleDocRef, (snap) => {
            const data = snap.exists() ? snap.data() : null
            setVehicle(data ? { ...data, id: vehicleId } : null)
        })

        // Purchase details
        const purchaseDocRef = doc(db, "purchaseDetails", vehicleId)
        const unsubscribePurchase = onSnapshot(purchaseDocRef, (snap) => {
            const data = snap.exists() ? snap.data() : null
            setPurchaseDetails(data)

            // Update months since purchase
            if (data?.purchasedDate) {
                setVehicle((prev: any) =>
                    prev ? { ...prev, months: calculateMonthsSincePurchase(data.purchasedDate) } : prev
                )
            }
        })

        // Purchase payments
        const purchasePaymentsCol = collection(db, "purchaseDetails", vehicleId, "purchasePayment")
        const unsubscribePurchasePayments = onSnapshot(purchasePaymentsCol, (snap) => {
            const payments = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
            setPurchasePayments(payments)
        })

        // Sales details
        const salesDocRef = doc(db, "salesDetails", vehicleId)
        const unsubscribeSales = onSnapshot(salesDocRef, (snap) => {
            const data = snap.exists() ? snap.data() : null
            setSalesDetails(data)
        })

        // Sales payments
        const salesPaymentsCol = collection(db, "salesDetails", vehicleId, "salesPayments")
        const unsubscribeSalesPayments = onSnapshot(salesPaymentsCol, (snap) => {
            const payments = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
            setSalesPayments(payments)
        })

        setLoading(false)

        return () => {
            unsubscribeVehicle()
            unsubscribePurchase()
            unsubscribePurchasePayments()
            unsubscribeSales()
            unsubscribeSalesPayments()
        }
    }, [vehicleId])

    useEffect(() => {
        if (!vehicleId) return

        // Listen to quotations for this vehicle
        const quotationsCol = collection(db, "quotations")

        const unsubscribeQuotations = onSnapshot(quotationsCol, (snap) => {
            const vehicleQuotations = snap.docs
                .filter(doc => doc.data().vehicleId === vehicleId)
                .map(doc => ({
                    id: doc.id,
                    data: doc.data(),
                    payments: [],
                }))

            setQuotations(vehicleQuotations)

            // Attach listeners for quotationPayments
            const paymentUnsubs: (() => void)[] = []

            vehicleQuotations.forEach((quotation) => {
                const paymentsCol = collection(
                    db,
                    "quotations",
                    quotation.id,
                    "quotationPayments"
                )

                const unsub = onSnapshot(paymentsCol, (paySnap) => {
                    const payments = paySnap.docs.map(d => ({
                        id: d.id,
                        ...d.data(),
                    }))

                    setQuotations(prev =>
                        prev.map(q =>
                            q.id === quotation.id
                                ? { ...q, payments }
                                : q
                        )
                    )
                })

                paymentUnsubs.push(unsub)
            })

            // Cleanup sub-listeners when quotations change
            return () => {
                paymentUnsubs.forEach(unsub => unsub())
            }
        })

        return () => unsubscribeQuotations()
    }, [vehicleId])


    // Recalculate remaining amounts whenever data changes
    useEffect(() => {
        const pTotal = purchaseDetails?.purchasedAmount || 0
        setPRemaining(calculateRemaining(pTotal, purchasePayments))

        const sTotal = salesDetails?.salesAmount || 0
        setSRemaining(calculateRemaining(sTotal, salesPayments))

        // Calculate total cost
        const months = vehicle?.months || 0
        setTotalCost(calculateTotalCost(pTotal, months))
    }, [purchaseDetails, purchasePayments, salesDetails, salesPayments, vehicle?.months])

    return (
        <VehicleContext.Provider
            value={{
                vehicle,
                purchaseDetails,
                purchasePayments,
                salesDetails,
                salesPayments,
                quotations,
                pRemaining,
                sRemaining,
                totalCost,
                loading,
            }}
        >
            {children}
        </VehicleContext.Provider>
    )
}
