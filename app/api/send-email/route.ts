import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
    try {
        const { email, subject, text, html } = await req.json();

        if (!email || !subject || (!text && !html)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com', // Default fallback for dev/testing often gmail or similar
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Verify connection configuration (optional, but good for debugging)
        // await transporter.verify(); 

        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Stuttgart App" <no-reply@stuttgart.com>', // sender address
            to: email, // list of receivers
            subject: subject, // Subject line
            text: text, // plain text body
            html: html, // html body
        });

        console.log("Message sent: %s", info.messageId);

        return NextResponse.json({ message: 'Email sent successfully', messageId: info.messageId });
    } catch (error) {
        console.error("Error sending email:", error);
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
}
