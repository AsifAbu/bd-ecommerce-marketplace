import nodemailer from "nodemailer";

/**
 * Shared email sender over SMTP (Mailpit locally: http://localhost:8025).
 * Pre-release checklist: point SMTP_* at the production email provider.
 */
export interface Mail {
  to: string[];
  subject: string;
  text: string;
}

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
});

export async function sendMail(mail: Mail): Promise<void> {
  await transport.sendMail({ from: process.env.EMAIL_FROM || "no-reply@ecom.test", ...mail });
}

export const appUrl = (path: string) => new URL(path, process.env.AUTH_URL ?? "http://localhost:3000").toString();
