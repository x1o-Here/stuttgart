// app/api/vehicle/[id]/sell/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/firebase/firebase-admin"
import { z } from "zod"

const sellVehicleSchema = z.object({
  salesDate: z.string(),
  salesAmount: z.number().positive(),
  buyerName: z.string().min(2),
  buyerContact: z.string().min(7),
})

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: vehicleId } = await context.params

    if (!vehicleId) {
      return NextResponse.json(
        { success: false, message: "Missing vehicle ID" },
        { status: 400 }
      )
    }

    const body = await req.json()
    const data = sellVehicleSchema.parse(body)

    // 🔎 Ensure vehicle exists
    const vehicleRef = db.collection("vehicles").doc(vehicleId)
    const vehicleSnap = await vehicleRef.get()

    if (!vehicleSnap.exists) {
      return NextResponse.json(
        { success: false, message: "Vehicle not found" },
        { status: 404 }
      )
    }

    // 🔗 salesDetails doc ID === vehicle ID
    const salesDetailsRef = db.collection("salesDetails").doc(vehicleId)

    const salesDetailsData = {
      vehicleId,
      salesDate: new Date(data.salesDate),
      salesAmount: data.salesAmount,
      buyerName: data.buyerName,
      buyerContact: data.buyerContact,
      entityStatus: true,
      createdAt: new Date(),
    }

    // 🔒 Atomic update
    const batch = db.batch()
    batch.update(vehicleRef, {
      vehicleStatus: "sold",
      soldAt: new Date(),
    })
    batch.set(salesDetailsRef, salesDetailsData)

    await batch.commit()

    return NextResponse.json({ success: true, vehicleId })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { success: false, message: "Failed to sell vehicle" },
      { status: 400 }
    )
  }
}
