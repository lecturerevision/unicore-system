/**
 * Email service for UniCore.
 *
 * Priority:
 *  1. Gmail SMTP (SMTP_HOST / SMTP_USER / SMTP_PASS env vars) — sends to any address
 *  2. Resend via Replit Connectors — test mode only delivers to account owner's email
 *  3. Dev fallback — logs code to console and returns it in the API response
 */

import { Resend } from "resend";

interface SendResult {
  sent: boolean;
  devCode?: string;
}

// ── Resend client (never cache) ───────────────────────────────────────────────
async function getResendClient(): Promise<{
  client: Resend;
  from: string;
  accountEmail?: string;
} | null> {
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY
      ? "repl " + process.env.REPL_IDENTITY
      : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

    if (!hostname || !xReplitToken) return null;

    const data = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
      { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } }
    )
      .then((r) => r.json())
      .then((d) => d.items?.[0]);

    if (!data?.settings?.api_key) return null;

    return {
      client: new Resend(data.settings.api_key),
      from: "UniCore <onboarding@resend.dev>",
      accountEmail: data.settings.from_email as string | undefined,
    };
  } catch {
    return null;
  }
}

// ── Email HTML template ───────────────────────────────────────────────────────
function emailHtml(name: string, code: string) {
  return `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;background:#3b82f6;border-radius:10px;margin-bottom:8px">
        <span style="color:#fff;font-size:22px;font-weight:bold">U</span>
      </div>
      <h1 style="margin:0;font-size:20px;color:#111827">UniCore</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280">University Complaint Management</p>
    </div>
    <div style="background:#fff;border-radius:8px;padding:24px;border:1px solid #e5e7eb">
      <p style="margin:0 0 16px;color:#374151;font-size:15px">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 20px;color:#374151;font-size:14px">Enter the code below to verify your email address:</p>
      <div style="background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin-bottom:20px">
        <span style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#1d4ed8;font-family:monospace">${code}</span>
      </div>
      <p style="margin:0;font-size:12px;color:#9ca3af">
        This code expires in <strong>15 minutes</strong>. If you didn't register, ignore this email.
      </p>
    </div>
  </div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function sendVerificationEmail(
  to: string,
  name: string,
  code: string
): Promise<SendResult> {
  const subject = "Verify your UniCore account";
  const text = `Hi ${name},\n\nYour UniCore verification code is:\n\n  ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not register, ignore this message.`;
  const html = emailHtml(name, code);

  // 1. Gmail SMTP — can send to any recipient ──────────────────────────────
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const fromAddr = process.env.EMAIL_FROM || smtpUser || "noreply@unicore.edu";

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({ from: fromAddr, to, subject, text, html });
      console.log(`[email] Sent via SMTP → ${to}`);
      return { sent: true };
    } catch (err) {
      console.error("[email] SMTP failed:", err);
    }
  }

  // 2. Resend — test mode can only deliver to the Resend account owner ─────
  const resend = await getResendClient();
  if (resend) {
    try {
      const deliverTo = resend.accountEmail || to;
      const testSubject =
        resend.accountEmail && resend.accountEmail !== to
          ? `[UniCore] Code for ${to} — ${subject}`
          : subject;

      const result = await resend.client.emails.send({
        from: resend.from,
        to: deliverTo,
        subject: testSubject,
        text: resend.accountEmail && resend.accountEmail !== to
          ? `[Code for: ${to}]\n\n${text}`
          : text,
        html,
      });

      if (result.error) {
        console.error("[email] Resend error:", result.error);
      } else {
        console.log(`[email] Sent via Resend → ${deliverTo} (for: ${to})`);
        return { sent: true };
      }
    } catch (err) {
      console.error("[email] Resend threw:", err);
    }
  }

  // 3. Dev fallback — print to console ────────────────────────────────────
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   [DEV] Email verification code          ║`);
  console.log(`║   To:   ${to.padEnd(34)}║`);
  console.log(`║   Code: ${code.padEnd(34)}║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  return { sent: false, devCode: code };
}
