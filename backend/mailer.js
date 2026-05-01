import nodemailer from 'nodemailer';

const getTransport = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Missing SMTP_HOST, SMTP_USER, or SMTP_PASS');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user,
      pass,
    },
  });
};

export const sendApprovalEmail = async ({ to, itemName, quantity }) => {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    throw new Error('Missing SMTP_FROM or SMTP_USER');
  }

  const transporter = getTransport();
  const subject = `Supplier request approved: ${itemName}`;
  const text = [
    `Hello,`,
    '',
    `Your supplier request for ${itemName} (${quantity}) has been approved.`,
    '',
    'You can prepare the stock for delivery.',
  ].join('\n');

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });
};

export const sendRequestStatusEmail = async ({ to, itemName, quantity, unit, status }) => {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    throw new Error('Missing SMTP_FROM or SMTP_USER');
  }

  const normalizedStatus = String(status || '').toLowerCase();
  if (!['approved', 'void'].includes(normalizedStatus)) {
    return;
  }

  const transporter = getTransport();
  const amountLabel = `${quantity}${unit ? ` ${unit}` : ''}`.trim();
  const statusLabel = normalizedStatus === 'approved' ? 'approved' : 'voided';
  const subject = `Supplier request ${statusLabel}: ${itemName}`;

  const text = normalizedStatus === 'approved'
    ? [
      'Hello,',
      '',
      `Your supplier request for ${itemName} (${amountLabel}) has been approved.`,
      '',
      'Please prepare the stock for delivery.',
    ].join('\n')
    : [
      'Hello,',
      '',
      `Your supplier request for ${itemName} (${amountLabel}) has been voided.`,
      '',
      'No stock preparation is needed for this request.',
    ].join('\n');

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });
};
