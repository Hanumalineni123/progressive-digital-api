import { logger } from '../lib/logger.js';

export async function sendEnrollmentConfirmation(enrollment) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('RESEND_API_KEY not set — skipping enrollment email');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Progressive Digital <hello@progressivedigitalco.com>',
      to: enrollment.customer_email,
      subject: 'Enrollment confirmed — Progressive Digital',
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#0f1117;padding:24px 32px;">
            <p style="font-size:18px;font-weight:800;color:#f5f4f0;margin:0;">
              Progressive<span style="color:#c8391f;">.</span>Digital
            </p>
          </div>
          <div style="padding:32px;">
            <h1 style="font-size:22px;margin:0 0 16px;">You're enrolled!</h1>
            <p style="color:#555;line-height:1.6;">
              Thanks ${enrollment.customer_name || 'there'}! Your enrollment in 
              <strong>${enrollment.course_id}</strong> is confirmed.
            </p>
            <p style="color:#555;line-height:1.6;margin-top:16px;">
              We'll be in touch shortly with next steps and access details.
            </p>
            <p style="color:#555;line-height:1.6;margin-top:32px;">
              — The Progressive Digital Team
            </p>
          </div>
          <div style="border-top:1px solid #eee;padding:16px 32px;">
            <p style="font-size:12px;color:#999;margin:0;">
              progressivedigitalco.com
            </p>
          </div>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error('Resend error: ' + res.status + ' ' + body);
  }

  logger.info({ enrollmentId: enrollment.id }, 'Enrollment confirmation email sent');
}
