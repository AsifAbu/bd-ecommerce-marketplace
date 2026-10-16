import net from "node:net";

/**
 * Minimal plain-text email over SMTP (no auth, no TLS): Mailpit in test mode.
 * A real email provider replaces this before release (pre-release checklist).
 * Move to src/lib/ when another feature needs email.
 */
export interface Mail {
  to: string[];
  subject: string;
  text: string;
}

function parseFrom(raw: string) {
  const match = raw.match(/<([^>]+)>/);
  return { header: raw, address: match ? match[1] : raw };
}

const clean = (s: string) => s.replace(/[\r\n]+/g, " ");

export async function sendMail(mail: Mail, env: Record<string, string | undefined> = process.env): Promise<void> {
  if (mail.to.length === 0) return;
  const host = env.SMTP_HOST || "localhost";
  const port = Number(env.SMTP_PORT || 1025);
  const from = parseFrom(env.EMAIL_FROM || "no-reply@ecom.test");

  const body = mail.text.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
  const message = [
    `From: ${clean(from.header)}`,
    `To: ${mail.to.map(clean).join(", ")}`,
    `Subject: ${clean(mail.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
    ".",
  ].join("\r\n");

  const commands = [
    "EHLO ecom.local",
    `MAIL FROM:<${clean(from.address)}>`,
    ...mail.to.map((t) => `RCPT TO:<${clean(t)}>`),
    "DATA",
    message,
    "QUIT",
  ];

  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(10_000, () => socket.destroy(new Error("SMTP timeout")));
    let buffer = "";
    let step = 0;
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      // Wait for a complete final reply line ("250 ..." not "250-...").
      const lines = buffer.split("\r\n").filter(Boolean);
      const last = lines[lines.length - 1];
      if (!last || !/^\d{3} /.test(last) || !buffer.endsWith("\r\n")) return;
      buffer = "";
      if (Number(last.slice(0, 3)) >= 400) {
        socket.destroy(new Error(`SMTP error: ${last}`));
        return;
      }
      if (step < commands.length) socket.write(`${commands[step++]}\r\n`);
      else socket.end();
    });
    socket.on("error", reject);
    socket.on("close", () => (step >= commands.length ? resolve() : reject(new Error("SMTP connection closed"))));
  });
}
