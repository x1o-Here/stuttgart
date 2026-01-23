import { Timestamp } from "firebase/firestore"

export function calculateMonthsSincePurchase(
    purchasedDateInput: Timestamp | Date | string | null | undefined,
    endDateInput?: Timestamp | Date | string | null
): number {
    if (!purchasedDateInput) return 0

    let purchasedDate: Date
    let endDate: Date

    // --- Purchased Date ---
    if (purchasedDateInput instanceof Timestamp) purchasedDate = purchasedDateInput.toDate()
    else if (typeof (purchasedDateInput as any)?.toDate === "function") purchasedDate = (purchasedDateInput as any).toDate()
    else purchasedDate = new Date(purchasedDateInput)

    if (isNaN(purchasedDate.getTime())) return 0

    // --- End Date (default to now) ---
    if (!endDateInput) endDate = new Date()
    else if (endDateInput instanceof Timestamp) endDate = endDateInput.toDate()
    else if (typeof (endDateInput as any)?.toDate === "function") endDate = (endDateInput as any).toDate()
    else endDate = new Date(endDateInput)

    if (isNaN(endDate.getTime())) endDate = new Date()

    const yearsDiff = endDate.getFullYear() - purchasedDate.getFullYear()
    const monthsDiff = endDate.getMonth() - purchasedDate.getMonth()

    const totalMonths = yearsDiff * 12 + monthsDiff
    return Math.max(0, totalMonths)
}
