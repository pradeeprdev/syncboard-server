import nodemailer from "nodemailer";

const getTransport = () => {
  if (process.env.NODE_ENV === "test") {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : undefined;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !port || !user || !pass) {
    // Fallback to ethereal create if not configured (dev convenience)
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });
};

const sendEmail = async ({ to, subject, text, html, from }) => {
  const transport = getTransport();

  const info = await transport.sendMail({
    from: from || process.env.EMAIL_FROM || `no-reply@${process.env.APP_DOMAIN || "localhost"}`,
    to,
    subject,
    text,
    html,
  });

  return info;
};

export const sendPasswordResetEmail = async (to, token) => {
  const resetLink = `${process.env.CLIENT_URL}/reset-password/${token}`;
  const subject = "Reset your SyncBoard password";
  const text = `You requested a password reset. Click the link to reset: ${resetLink}`;
  const html = `<p>You requested a password reset. Click the link below to reset your password (valid for 1 hour):</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    <p>If you did not request this, please ignore this email.</p>`;

  return sendEmail({ to, subject, text, html });
};

export const sendInvitationEmail = async (to, token, project, inviter) => {
  const link = `${process.env.CLIENT_URL}/accept-invite/${token}`;
  const subject = `Invitation to join project: ${project.name}`;
  const text = `${inviter.name || inviter.email} invited you to join project ${project.name}. Accept: ${link}`;
  const html = `<p><strong>${inviter.name || inviter.email}</strong> invited you to join the project <strong>${project.name}</strong>.</p>
    <p>Role: ${project.inviteRole || 'member'}</p>
    <p>Accept invitation: <a href="${link}">${link}</a></p>`;

  return sendEmail({ to, subject, text, html });
};

export default { sendEmail, sendPasswordResetEmail, sendInvitationEmail };
