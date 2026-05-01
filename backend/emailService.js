import { ImapFlow } from 'imapflow';
import { createSupplierRequest, listActiveSupplierEmails, logSystemEvent } from './supplierService.js';

const RESTOCK_APPROVAL_SUBJECT = 'restock approval';

const getImapConfig = () => {
  const host = process.env.IMAP_HOST || 'imap.gmail.com';
  const port = Number(process.env.IMAP_PORT || 993);
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASS;

  if (!user || !pass) {
    throw new Error('Missing IMAP_USER or IMAP_PASS');
  }

  return {
    host,
    port,
    secure: String(process.env.IMAP_SECURE || 'true') === 'true',
    auth: { user, pass },
  };
};

const getEnvFallbackSupplierEmails = () => String(process.env.SUPPLIER_EMAILS || process.env.SUPPLIER_EMAIL || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

const normalizeUnit = (value) => {
  const unit = String(value || '').trim().toLowerCase();
  if (unit === 'l') return 'L';
  if (['g', 'kg', 'ml', 'pcs', 'units', 'bottles'].includes(unit)) return unit;
  return null;
};

// Enhanced email validation function
const validateSupplierEmail = (sender, supplierEmails) => {
  const validations = [];
  const sender_lower = String(sender || '').trim().toLowerCase();
  const isAllowedSender = Boolean(sender_lower && supplierEmails.includes(sender_lower));

  if (!sender) {
    validations.push({ valid: false, reason: 'No sender email found' });
  } else if (!isAllowedSender) {
    validations.push({ valid: false, reason: `Sender ${sender_lower} not in active supplier registry` });
  } else {
    validations.push({ valid: true, reason: 'Email format valid' });
  }

  return validations;
};

// Enhanced parsing with validation logging
const parseAndValidateRequest = (body) => {
  const normalizedBody = String(body || '');

  // Check for minimum body length
  if (normalizedBody.length < 3) {
    return { valid: false, errors: ['Email body is too short'], parsed: null };
  }

  const labeledItemMatch = normalizedBody.match(/^\s*item\s*:\s*(.+)$/im);
  const labeledItemIdMatch = normalizedBody.match(/^\s*(?:inventory[_\s-]*id|item[_\s-]*id|id)\s*:\s*([a-zA-Z0-9._-]+)\s*$/im);
  const labeledQuantityMatch = normalizedBody.match(/^\s*quantity\s*:\s*(\d+(?:\.\d+)?)\b/im);
  const labeledUnitMatch = normalizedBody.match(/^\s*unit\s*:\s*([a-zA-Z]+)\b/im);

  const errors = [];

  if (!labeledItemMatch && !labeledItemIdMatch) {
    errors.push('Missing item name or inventory ID in email body');
  }

  if (!labeledQuantityMatch) {
    errors.push('Missing or invalid quantity in email body');
  } else {
    const qty = Number(labeledQuantityMatch[1]);
    if (qty <= 0) {
      errors.push(`Invalid quantity: ${qty} (must be > 0)`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, parsed: null };
  }

  // All required fields present, construct parsed object
  const requestedItem = labeledItemMatch?.[1]?.trim() || labeledItemIdMatch?.[1]?.trim() || '';
  const parsed = {
    itemName: requestedItem,
    quantity: Number(labeledQuantityMatch[1]),
    unit: normalizeUnit(labeledUnitMatch?.[1]),
  };

  return { valid: true, errors: [], parsed };
};

const loadAllowedSupplierEmails = async () => {
  const fallback = getEnvFallbackSupplierEmails();

  try {
    const databaseEmails = await listActiveSupplierEmails();
    if (databaseEmails.length > 0) {
      return databaseEmails;
    }
  } catch (error) {
    console.warn('Supplier contacts lookup failed, using env fallback:', error);
  }

  return fallback;
};

const extractPlainText = (source) => {
  if (!source) {
    return '';
  }

  if (typeof source === 'string') {
    return source;
  }

  return Buffer.from(source).toString('utf8');
};

const parseRequestFromBody = (body) => {
  const normalizedBody = String(body || '');

  const labeledItemMatch = normalizedBody.match(/^\s*item\s*:\s*(.+)$/im);
  const labeledItemIdMatch = normalizedBody.match(/^\s*(?:inventory[_\s-]*id|item[_\s-]*id|id)\s*:\s*([a-zA-Z0-9._-]+)\s*$/im);
  const labeledQuantityMatch = normalizedBody.match(/^\s*quantity\s*:\s*(\d+(?:\.\d+)?)\b/im);
  const labeledUnitMatch = normalizedBody.match(/^\s*unit\s*:\s*([a-zA-Z]+)\b/im);

  if ((labeledItemMatch || labeledItemIdMatch) && labeledQuantityMatch) {
    const requestedItem = labeledItemMatch?.[1]?.trim() || labeledItemIdMatch?.[1]?.trim() || '';
    return {
      itemName: requestedItem,
      quantity: Number(labeledQuantityMatch[1]),
      unit: normalizeUnit(labeledUnitMatch?.[1]),
    };
  }

  const compactLineMatch = normalizedBody.match(/^\s*(.+?)\s*[-–—,]\s*(\d+(?:\.\d+)?)(?:\s*([a-zA-Z]+))?\s*$/im);
  if (compactLineMatch) {
    return {
      itemName: compactLineMatch[1].trim(),
      quantity: Number(compactLineMatch[2]),
      unit: normalizeUnit(compactLineMatch[3]),
    };
  }

  return null;
};

const processMessage = async (client, message, supplierEmails) => {
  const sender = message.envelope?.from?.[0]?.address?.toLowerCase();
  const subject = normalizeText(message.envelope?.subject);
  const body = extractPlainText(message.source);
  const isRestockApprovalSubject = subject.includes(RESTOCK_APPROVAL_SUBJECT);

  // Validate email sender
  const senderValidation = validateSupplierEmail(sender, supplierEmails);
  const isAllowedSender = senderValidation[0]?.valid ?? false;

  // Parse and validate request body
  const { valid: isValidRequest, errors: parseErrors, parsed } = parseAndValidateRequest(body);

  console.log(
    `[INGEST] UID ${message.uid} sender=${sender ?? 'unknown'} subject="${subject}" allowed=${isAllowedSender} restock=${isRestockApprovalSubject} parsed=${isValidRequest} quantity=${parsed?.quantity ?? 'n/a'}`
  );

  // Mark as seen if any validation fails
  if (!isAllowedSender || !isRestockApprovalSubject || !isValidRequest) {
    await client.messageFlagsAdd(message.uid, ['\\Seen']);
    
    if (!isRestockApprovalSubject) {
      console.log(`[INGEST] UID ${message.uid} skipped: subject did not match "${RESTOCK_APPROVAL_SUBJECT}".`);
    } else if (!isAllowedSender) {
      console.log(`[INGEST] UID ${message.uid} skipped: ${senderValidation[0]?.reason || 'sender validation failed'}`);
    } else if (!isValidRequest) {
      console.log(`[INGEST] UID ${message.uid} skipped: validation failed - ${parseErrors.join('; ')}`);
      
      // Log validation failure to system events for audit trail
      await logSystemEvent({
        domain: 'supplier_requests',
        kind: 'email_validation_failed',
        title: 'Email Validation Failed',
        detail: `Email from ${sender} failed validation: ${parseErrors.join('; ')}`,
        entityId: null,
        metadata: {
          supplier: sender,
          sourceUid: String(message.uid),
          errors: parseErrors,
        },
      });
    }
    return;
  }

  const created = await createSupplierRequest({
    itemName: parsed.itemName,
    quantity: parsed.quantity,
    unit: parsed.unit,
    supplierEmail: sender,
    sourceUid: String(message.uid),
  });

  console.log(
    `[INGEST] UID ${message.uid} stored request -> item=${created.itemName} inventory=${created.inventoryItemId ?? 'none'} qty=${created.quantity} ${created.unit ?? ''}`.trim()
  );

  // Log the event
  await logSystemEvent({
    domain: 'supplier_requests',
    kind: 'request_created_via_email',
    title: 'Supplier Request Created',
    detail: `Email received from ${sender} requesting ${created.quantity} ${created.unit || 'units'} of ${created.itemName}`,
    entityId: created.id,
    metadata: {
      supplier: sender,
      sourceUid: String(message.uid),
      item: created.itemName,
      quantity: created.quantity,
      unit: created.unit,
    },
  });

  await client.messageFlagsAdd(message.uid, ['\\Seen']);
};

const fetchSingleMessage = async (client, uid, options) => {
  for await (const message of client.fetch(uid, options)) {
    return message;
  }

  return null;
};

const clearExistingInboxBacklog = async (client) => {
  const processExisting = String(process.env.IMAP_PROCESS_EXISTING || 'false') === 'true';

  if (processExisting) {
    return;
  }

  const unseenUids = await client.search({ seen: false });
  if (unseenUids.length === 0) {
    return;
  }

  await client.messageFlagsAdd(unseenUids, ['\\Seen']);
  console.log(`Skipped ${unseenUids.length} pre-existing unread message(s) on startup.`);
};

const pollInbox = async (client) => {
  const supplierEmails = await loadAllowedSupplierEmails();
  const lock = await client.getMailboxLock('INBOX');

  try {
    // Search only matching restock approval subjects so unrelated mail is ignored.
    console.log('[POLL] Starting inbox check...');
    const restockUids = await client.search({ all: true, subject: RESTOCK_APPROVAL_SUBJECT });
    const newestFirstUids = [...restockUids].reverse();
    console.log(`[POLL] Checked inbox. Found ${restockUids.length} restock approval email(s). Active suppliers: ${supplierEmails.join(', ')}`);

    if (restockUids.length > 0) {
      console.log(`[DEBUG] Fetching last 5 for inspection...`);
      const lastFive = newestFirstUids.slice(0, 5);
      for (const uid of lastFive) {
        const msg = await fetchSingleMessage(client, uid, { envelope: true, uid: true });
        const from = msg?.envelope?.from?.[0]?.address || 'unknown';
        const subj = normalizeText(msg?.envelope?.subject || 'no subject');
        console.log(`  [DEBUG] UID ${uid}: From=${from}, Subject=${subj}`);
      }
    }

    // Process only restock emails; source_uid prevents duplicate supplier requests.
    for (const uid of newestFirstUids) {
      const envelopeMessage = await fetchSingleMessage(client, uid, {
        envelope: true,
        uid: true,
      });

      const sender = envelopeMessage?.envelope?.from?.[0]?.address?.toLowerCase();
      const subject = normalizeText(envelopeMessage?.envelope?.subject);
      const isAllowedSender = Boolean(sender && supplierEmails.includes(sender));
      const isRestockApprovalSubject = subject.includes(RESTOCK_APPROVAL_SUBJECT);

      console.log(`[POLL] UID ${uid} sender=${sender ?? 'unknown'} subject="${subject}" allowed=${isAllowedSender} restock=${isRestockApprovalSubject}`);

      if (!isAllowedSender || !isRestockApprovalSubject) {
        await client.messageFlagsAdd(uid, ['\\Seen']);
        continue;
      }

      const fullMessage = await fetchSingleMessage(client, uid, {
        envelope: true,
        source: true,
        uid: true,
      });

      if (fullMessage) {
        await processMessage(client, fullMessage, supplierEmails);
      }
    }
  } finally {
    lock.release();
  }
};

export const startEmailListener = async () => {
  const config = getImapConfig();
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    socketTimeout: Number(process.env.IMAP_SOCKET_TIMEOUT || 120000),
    logger: false,
  });

  client.on('error', (error) => {
    console.error('IMAP client error:', error);
  });

  await client.connect();
  await client.mailboxOpen('INBOX');

  await clearExistingInboxBacklog(client).catch((error) => {
    console.error('Failed to clear existing inbox backlog:', error);
  });

  await pollInbox(client).catch((error) => {
    console.error('Initial supplier mailbox poll failed:', error);
  });

  const timer = setInterval(() => {
    void pollInbox(client).catch((error) => {
      console.error('Supplier mailbox poll failed:', error);
    });
  }, 10000);

  const stop = async () => {
    clearInterval(timer);
    await client.logout();
  };

  return { client, stop };
};
