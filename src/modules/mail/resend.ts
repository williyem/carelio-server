import { Resend } from 'resend';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!resend) {
    logger.warn(
      `[mail] RESEND_API_KEY not set — skipping send to ${params.to}: ${params.subject}`
    );
    logger.info(`[mail] ${params.text}`);
    return { skipped: true as const };
  }

  const { error } = await resend.emails.send({
    from: env.RESEND_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (error) {
    logger.error(`[mail] Failed to send to ${params.to}: ${error.message}`);
    throw new Error(error.message);
  }

  return { skipped: false as const };
}

export async function sendInviteEmail(input: {
  to: string;
  inviteLink: string;
  doctorName?: string;
}) {
  const fromLabel = input.doctorName ?? 'your care team';
  const subject = 'You are invited to Carelio';
  const text = `You have been invited to Carelio by ${fromLabel}. Open this link to complete registration: ${input.inviteLink}`;
  const html = `
    <p>You have been invited to <strong>Carelio</strong> by ${fromLabel}.</p>
    <p><a href="${input.inviteLink}">Complete your registration</a></p>
    <p>Or copy this link:<br/><code>${input.inviteLink}</code></p>
  `;

  return sendEmail({ to: input.to, subject, html, text });
}

export async function sendVerificationOtpEmail(input: {
  to: string;
  otp: string;
}) {
  const subject = 'Your Carelio verification code';
  const text = `Your Carelio verification code is ${input.otp}. It expires in 10 minutes.`;
  const html = `
    <p>Your Carelio verification code is:</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${input.otp}</p>
    <p>It expires in 10 minutes.</p>
  `;

  return sendEmail({ to: input.to, subject, html, text });
}

export async function sendPasswordResetOtpEmail(input: {
  to: string;
  otp: string;
}) {
  const subject = 'Your Carelio password reset code';
  const text = `Your Carelio password reset code is ${input.otp}. It expires in 10 minutes.`;
  const html = `
    <p>Your Carelio password reset code is:</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${input.otp}</p>
    <p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p>
  `;

  return sendEmail({ to: input.to, subject, html, text });
}
