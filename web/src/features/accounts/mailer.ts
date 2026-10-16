import nodemailer from "nodemailer";

/**
 * Sends account emails over SMTP (Mailpit locally: http://localhost:8025).
 * Pre-release checklist: point SMTP_* at the production email provider.
 */
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false,
});

export async function sendEmail(to: string, subject: string, text: string) {
  await transport.sendMail({ from: process.env.EMAIL_FROM ?? "no-reply@ecom.test", to, subject, text });
}

export const appUrl = (path: string) => new URL(path, process.env.AUTH_URL ?? "http://localhost:3000").toString();
