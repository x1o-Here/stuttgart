import { Timestamp } from "firebase/firestore"

export function calculateMonthsSincePurchase(
    purchasedDateInput: Timestamp | Date | string | null | undefined
): number {
    if (!purchasedDateInput) return 0

    let purchasedDate: Date

    // Firestore Timestamp
    if (purchasedDateInput instanceof Timestamp) {
        purchasedDate = purchasedDateInput.toDate()
    }
    // Timestamp-like (safety)
    else if (typeof (purchasedDateInput as any)?.toDate === "function") {
        purchasedDate = (purchasedDateInput as any).toDate()
    }
    // String or Date
    else {
        purchasedDate = new Date(purchasedDateInput)
    }

    if (isNaN(purchasedDate.getTime())) return 0

    const now = new Date()

    const yearsDiff = now.getFullYear() - purchasedDate.getFullYear()
    const monthsDiff = now.getMonth() - purchasedDate.getMonth()

    const totalMonths = yearsDiff * 12 + monthsDiff

    return Math.max(0, totalMonths)
}
