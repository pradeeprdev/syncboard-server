import nodemailer from "nodemailer";

const getTransport = () => {
  if (process.env.NODE_ENV === "test") {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 587);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !port || !user || !pass) {
    console.warn("Email env missing. Using JSON transport.");
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    family: 4,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    auth: {
      user,
      pass,
    },
  });
};

export const sendEmail = async ({ to, subject, text, html, from }) => {
  const transport = getTransport();

  console.log("SMTP config:", {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER,
    passLoaded: Boolean(process.env.EMAIL_PASS),
    from: process.env.EMAIL_FROM,
  });

  const info = await transport.sendMail({
    from:
      from ||
      process.env.EMAIL_FROM ||
      `SyncBoard <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });

  return info;
};

export const sendPasswordResetEmail = async (to, token) => {
  const resetLink = `${process.env.CLIENT_URL}/reset-password/${token}`;

  return sendEmail({
    to,
    subject: "Reset your SyncBoard password",
    text: `Reset your password: ${resetLink}`,
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>This link is valid for 1 hour.</p>
    `,
  });
};

export const sendInvitationEmail = async (to, token, project, inviter) => {
  const link = `${process.env.CLIENT_URL}/accept-invite/${token}`;

  return sendEmail({
    to,
    subject: `Invitation to join project: ${project.name}`,
    text: `${inviter.name || inviter.email} invited you to join ${project.name}. Accept: ${link}`,
    html: `
      <p><strong>${inviter.name || inviter.email}</strong> invited you to join <strong>${project.name}</strong>.</p>
      <p>Accept invitation:</p>
      <p><a href="${link}">${link}</a></p>
    `,
  });
};

export default {
  sendEmail,
  sendPasswordResetEmail,
  sendInvitationEmail,
};