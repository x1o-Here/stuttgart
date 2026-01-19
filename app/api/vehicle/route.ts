import { NextResponse } from "next/server"
import { db } from "@/lib/firebase/firebase-admin"
import { z } from "zod"

const vehicleSchema = z.object({
    purchasedDate: z.string(), // ISO string from client
    vehicleNo: z.string(),
    make: z.string(),
    yom: z.number(),
    isCR: z.boolean(),
    sellerName: z.string(),
    sellerContact: z.string(),
    legalOwner: z.string(),
    purchasedAmount: z.number(),
})

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const data = vehicleSchema.parse(body)
        console.log("data server:", body)

        // 1️⃣ Create vehicle doc (auto ID)
        const vehicleRef = db.collection("vehicles").doc()

        const vehicleData = {
            vehicleNo: data.vehicleNo,
            make: data.make,
            yom: data.yom,
            vehicleStatus: "active",
            entityStatus: true,
            createdAt: new Date(),
        }

        // 2️⃣ Purchase details doc WITH SAME ID
        const purchaseData = {
            vehicleId: vehicleRef.id,
            purchasedDate: data.purchasedDate,
            sellerName: data.sellerName,
            sellerContact: data.sellerContact,
            isCR: data.isCR,
            legalOwner: data.legalOwner,
            purchasedAmount: data.purchasedAmount,
            entityStatus: true,
            createdAt: new Date(),
        }

        // 3️⃣ Sales details doc (initially same as purchaseAmount)
        const salesDetailsData = {
            vehicleId: vehicleRef.id,
            entityStatus: true,
            createdAt: new Date(),
        }

        // 4️⃣ Atomic write
        const batch = db.batch()
        batch.set(vehicleRef, vehicleData)
        batch.set(db.collection("purchaseDetails").doc(vehicleRef.id), purchaseData)
        batch.set(db.collection("salesDetails").doc(vehicleRef.id), salesDetailsData)

        await batch.commit()

        return NextResponse.json({
            success: true,
            vehicleId: vehicleRef.id,
        })
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { success: false, message: "Failed to add vehicle" },
            { status: 400 }
        )
    }
}
