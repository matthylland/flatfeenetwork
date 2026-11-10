/**
 * Outgoing email, sent through Resend's HTTP API. Without RESEND_API_KEY
 * (local development and tests) messages are kept in memory and logged
 * instead of sent.
 */
export type Email = { to: string; subject: string; text: string; replyTo?: string };

export const outbox: Email[] = [];

export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    outbox.push(email);
    if (process.env.NODE_ENV !== "test") console.log(`[email not sent: no RESEND_API_KEY] to=${email.to} subject=${email.subject}\n${email.text}`);
    return;
  }
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text, ...(email.replyTo ? { reply_to: email.replyTo } : {}) }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** The site's public address, for links in emails. */
export const siteUrl = () => (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
