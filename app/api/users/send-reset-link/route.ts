import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/firebase-admin";
import axios from "axios";

export async function POST(req: Request) {
  try {
    const { email, subject, htmlTemplate } = await req.json();

    if (!email || !htmlTemplate) {
      return NextResponse.json(
        { error: "Email and htmlTemplate are required" },
        { status: 400 },
      );
    }

    // 1. Generate the personalized password reset link
    const resetLink = await adminAuth.generatePasswordResetLink(email);

    // 2. Inject the link into the provided template
    const processedHtml = htmlTemplate.replace(/{{resetLink}}/g, resetLink);

    // 3. Prepare for internal API call
    const { origin } = new URL(req.url);

    // 4. Send the custom email via the central email API
    await axios.post(`${origin}/api/send-email`, {
      email,
      subject,
      html: processedHtml,
    });

    return NextResponse.json({ message: "Reset link sent successfully" });
  } catch (error: any) {
    console.error("Error in generate-reset-link:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate or send reset link" },
      { status: 500 },
    );
  }
}
