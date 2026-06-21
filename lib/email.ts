import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Transactional email. The provider lives behind a single `sendEmail()` so it
// can be swapped without touching callers. Currently Resend; to move to AWS SES
// later, replace the body of `sendEmail` with an SES `SendEmailCommand` (reusing
// the existing REGION / ACCESS_KEY_ID / SECRET_ACCESS_KEY env vars) — nothing
// else changes. All config is env-driven so handoff to another account is just
// new env values.
// ---------------------------------------------------------------------------

// Verified sender. Resend's shared `onboarding@resend.dev` works for testing to
// your own account email; use a verified domain address in production.
const EMAIL_FROM = process.env.EMAIL_FROM || "DDC <onboarding@resend.dev>";

type EmailInput = { to: string; subject: string; text: string; html: string };

async function sendEmail({ to, subject, text, html }: EmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
  if (error) throw new Error(`Email send failed: ${error.message}`);

  // ── AWS SES alternative (swap in later) ─────────────────────────────────
  // import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
  // const ses = new SESClient({ region: process.env.REGION });
  // await ses.send(new SendEmailCommand({
  //   Source: EMAIL_FROM,
  //   Destination: { ToAddresses: [to] },
  //   Message: {
  //     Subject: { Data: subject },
  //     Body: { Text: { Data: text }, Html: { Data: html } },
  //   },
  // }));
}

/** Send a password-reset code to a host. */
export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const subject = "Your DDC password reset code";
  const text =
    `Your password reset code is ${code}.\n\n` +
    `It expires in 15 minutes. If you didn't request this, you can safely ignore this email.`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#111">
      <p style="font-size:14px;font-weight:800;letter-spacing:0.18em;margin:0 0 16px">DD<span style="color:#FF3C00">C</span></p>
      <h1 style="font-size:20px;font-weight:800;margin:0 0 8px">Reset your password</h1>
      <p style="font-size:13px;color:#555;line-height:1.6;margin:0 0 16px">Use the code below to set a new password. It expires in 15 minutes.</p>
      <div style="font-size:30px;font-weight:800;letter-spacing:0.3em;background:#F5F5F5;border:1px solid #E0E0E0;border-radius:8px;padding:16px;text-align:center;margin:0 0 16px">${code}</div>
      <p style="font-size:11px;color:#888;line-height:1.6;margin:0">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    </div>`;
  await sendEmail({ to, subject, text, html });
}
