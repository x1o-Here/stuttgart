import { NextResponse } from "next/server"
import { db } from "@/lib/firebase/firebase-admin"

export async function PUT(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: vehicleId } = await context.params
        
        if (!vehicleId) {
            return NextResponse.json({ success: false, message: "Vehicle ID is required" }, { status: 400 })
        }

        const vehicleRef = db.collection("vehicles").doc(vehicleId)
        const snapshot = await vehicleRef.get()
        if (!snapshot.exists) {
            return NextResponse.json({ success: false, message: "Vehicle not found" }, { status: 404 })
        }

        // Soft delete
        await vehicleRef.update({
            entityStatus: false,
            updatedAt: new Date(),
        })

        return NextResponse.json({ success: true, message: "Vehicle soft deleted successfully" })
    } catch (error) {
        console.error(error)
        return NextResponse.json({ success: false, message: "Failed to delete vehicle" }, { status: 500 })
    }
}
