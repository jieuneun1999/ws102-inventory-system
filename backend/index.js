import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import cors from 'cors';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });
import { startEmailListener } from './emailService.js';
import { 
  listSupplierContacts, 
  upsertSupplierContact, 
  updateSupplierRequestStatusWithNotification,
  approveSupplierRequestWithAutomation,
  voidSupplierRequestWithReason,
} from './supplierService.js';
import {
  closeShiftSession,
  listPaymentReconciliationReports,
  listRefundAuditLogs,
  listShiftSessions,
  logPaymentReconciliation,
  logRefundAudit,
  openShiftSession,
} from './operationsService.js';

const shutdownHandlers = new Set();

const registerShutdown = (stop) => {
  shutdownHandlers.add(stop);

  const shutdown = async () => {
    for (const handler of shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error('Shutdown handler failed:', error);
      }
    }
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};

const ADMIN_PORT = Number(process.env.ADMIN_PORT || 8787);
// ADMIN_KEY: set this to a random secret in production. If unset, and ADMIN_MODE !== 'dev', requests are rejected.
const ADMIN_KEY = process.env.ADMIN_KEY ?? '';
// ADMIN_MODE: 'prod' (default) enforces admin key; 'dev' disables auth for quick local testing.
const ADMIN_MODE = process.env.ADMIN_MODE === 'dev' ? 'dev' : 'prod';

const createAdminServer = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Simple header auth to protect service-role endpoints.
  // If ADMIN_MODE='dev', auth is skipped so you can easily test locally.
  const requireAdmin = (req, res, next) => {
    if (ADMIN_MODE === 'dev') return next();
    const key = req.header('x-admin-key') || req.query.admin_key || (req.body && req.body.admin_key);
    if (!ADMIN_KEY) {
      console.warn('Admin key is not configured; rejecting admin requests. Set ADMIN_KEY or ADMIN_MODE=dev to override.');
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!key || key !== ADMIN_KEY) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    return next();
  };

  app.get('/supplier_contacts', requireAdmin, async (req, res) => {
    try {
      const rows = await listSupplierContacts();
      res.json(rows);
    } catch (err) {
      console.error('listSupplierContacts failed:', err?.message ?? err);
      res.status(500).json({ error: 'failed' });
    }
  });

  app.post('/supplier_contacts', requireAdmin, async (req, res) => {
    try {
      const { email, displayName, notes, active } = req.body || {};
      if (!email) return res.status(400).json({ error: 'missing email' });
      const created = await upsertSupplierContact({ email, displayName, notes, active });
      res.status(201).json(created);
    } catch (err) {
      console.error('upsertSupplierContact failed:', err?.message ?? err);
      res.status(500).json({ error: 'failed' });
    }
  });

  app.post('/supplier_requests/:id/status', requireAdmin, async (req, res) => {
    try {
      const requestId = String(req.params.id ?? '').trim();
      const status = String(req.body?.status ?? '').trim().toLowerCase();
      const reason = String(req.body?.reason ?? '').trim();

      if (!requestId) return res.status(400).json({ error: 'missing request id' });
      if (!['pending', 'approved', 'void'].includes(status)) return res.status(400).json({ error: 'invalid status' });

      let updated;
      if (status === 'approved') {
        // Use automation function for approval (includes inventory increase + event logging)
        updated = await approveSupplierRequestWithAutomation(requestId);
      } else if (status === 'void') {
        // Use automation function for void (includes event logging with reason)
        updated = await voidSupplierRequestWithReason(requestId, reason);
      } else {
        // For pending, just update status
        updated = await updateSupplierRequestStatusWithNotification(requestId, status);
      }

      res.json(updated);
    } catch (err) {
      console.error('supplier request status update failed:', err?.message ?? err);
      res.status(500).json({ error: 'failed' });
    }
  });

  app.get('/operations/shifts', requireAdmin, async (req, res) => {
    try {
      const rows = await listShiftSessions();
      res.json(rows);
    } catch (err) {
      console.error('listShiftSessions failed:', err?.message ?? err);
      res.status(500).json({ error: 'failed' });
    }
  });

  app.post('/operations/shifts/open', requireAdmin, async (req, res) => {
    try {
      const { openedBy, openedByName, openedByRole, openingCash, notes } = req.body || {};
      const created = await openShiftSession({ openedBy, openedByName, openedByRole, openingCash, notes });
      res.status(201).json(created);
    } catch (err) {
      console.error('openShiftSession failed:', err?.message ?? err);
      res.status(500).json({ error: 'failed' });
    }
  });

  app.post('/operations/shifts/:id/close', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { expectedCash, countedCash, closedBy, closedByName, notes } = req.body || {};
      const closed = await closeShiftSession({
        sessionId: id,
        expectedCash,
        countedCash,
        closedBy,
        closedByName,
        notes,
      });
      res.json(closed);
    } catch (err) {
      console.error('closeShiftSession failed:', err?.message ?? err);
      res.status(500).json({ error: 'failed' });
    }
  });

  app.get('/operations/reconciliation', requireAdmin, async (req, res) => {
    try {
      const rows = await listPaymentReconciliationReports();
      res.json(rows);
    } catch (err) {
      console.error('listPaymentReconciliationReports failed:', err?.message ?? err);
      res.status(500).json({ error: 'failed' });
    }
  });

  app.post('/operations/reconciliation', requireAdmin, async (req, res) => {
    try {
      const { reportDate, cashSales, cashReceived, cashChange, ewalletSales, note, createdBy } = req.body || {};
      const created = await logPaymentReconciliation({
        reportDate,
        cashSales,
        cashReceived,
        cashChange,
        ewalletSales,
        note,
        createdBy,
      });
      res.status(201).json(created);
    } catch (err) {
      console.error('logPaymentReconciliation failed:', err?.message ?? err);
      res.status(500).json({ error: 'failed' });
    }
  });

  app.get('/refunds', requireAdmin, async (req, res) => {
    try {
      const rows = await listRefundAuditLogs();
      res.json(rows);
    } catch (err) {
      console.error('listRefundAuditLogs failed:', err?.message ?? err);
      res.status(500).json({ error: 'failed' });
    }
  });

  app.post('/refunds', requireAdmin, async (req, res) => {
    try {
      const { orderId, orderNumber, amount, reason, processedBy, processedByName, note } = req.body || {};
      if (!orderNumber) return res.status(400).json({ error: 'missing orderNumber' });
      const created = await logRefundAudit({
        orderId,
        orderNumber,
        amount,
        reason,
        processedBy,
        processedByName,
        note,
      });
      res.status(201).json(created);
    } catch (err) {
      console.error('logRefundAudit failed:', err?.message ?? err);
      res.status(500).json({ error: 'failed' });
    }
  });

  const server = app.listen(ADMIN_PORT, () => {
    console.log(`Admin API listening on http://localhost:${ADMIN_PORT} (mode=${ADMIN_MODE})`);
    if (ADMIN_MODE === 'dev') console.log('Admin auth is DISABLED (ADMIN_MODE=dev).');
  });

  return async () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
};

const main = async () => {
  const stopAdmin = createAdminServer();
  registerShutdown(stopAdmin);

  const listener = await startEmailListener();
  registerShutdown(listener.stop);
  console.log('Supplier email listener started and polling every 10 seconds.');
};

main().catch((error) => {
  console.error('Failed to start supplier email listener or admin server:', error);
  process.exit(1);
});
