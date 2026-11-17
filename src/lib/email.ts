import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// SMTP transport for app emails (workspace invites). Auth emails are sent by Supabase itself.
// Locally SMTP_* points to Mailpit; in production to Gmail (see README).

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  if (!host || !port) {
    transporter = null;
    return transporter;
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: user && pass ? { user, pass } : undefined,
  });
  return transporter;
}

export function isEmailConfigured(): boolean {
  return getTransporter() !== null;
}

/** Sends an email. Returns false (and logs) instead of throwing, so callers can degrade gracefully. */
export async function sendEmail(message: { to: string; subject: string; html: string; text: string }) {
  const transport = getTransporter();
  if (!transport) return false;

  try {
    await transport.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, ...message });
    return true;
  } catch (error) {
    console.error("Failed to send email", error);
    return false;
  }
}

/** Escapes text for safe interpolation into HTML email bodies. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
