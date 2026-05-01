import { createClient } from '@supabase/supabase-js';
import { logSystemEvent } from './supplierService.js';

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const roundTo2 = (value) => Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;

export const normalizeShiftSession = (row) => ({
  id: row.id,
  openedBy: row.opened_by ?? null,
  openedByName: row.opened_by_name ?? null,
  openedByRole: row.opened_by_role ?? null,
  openedAt: row.opened_at,
  openingCash: Number(row.opening_cash ?? 0),
  expectedCash: row.expected_cash == null ? null : Number(row.expected_cash),
  countedCash: row.counted_cash == null ? null : Number(row.counted_cash),
  variance: row.variance == null ? null : Number(row.variance),
  closedBy: row.closed_by ?? null,
  closedByName: row.closed_by_name ?? null,
  closedAt: row.closed_at ?? null,
  status: row.status,
  notes: row.notes ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const normalizePaymentReconciliation = (row) => ({
  id: row.id,
  reportDate: row.report_date,
  cashSales: Number(row.cash_sales ?? 0),
  cashReceived: Number(row.cash_received ?? 0),
  cashChange: Number(row.cash_change ?? 0),
  ewalletSales: Number(row.ewallet_sales ?? 0),
  variance: Number(row.variance ?? 0),
  note: row.note ?? null,
  createdBy: row.created_by ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const normalizeRefundAudit = (row) => ({
  id: row.id,
  orderId: row.order_id ?? null,
  orderNumber: row.order_number,
  amount: Number(row.amount ?? 0),
  reason: row.reason,
  processedBy: row.processed_by ?? null,
  processedByName: row.processed_by_name ?? null,
  note: row.note ?? null,
  createdAt: row.created_at,
});

export const listShiftSessions = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('shift_sessions')
    .select('*')
    .order('opened_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeShiftSession);
};

export const listPaymentReconciliationReports = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('payment_reconciliation_reports')
    .select('*')
    .order('report_date', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizePaymentReconciliation);
};

export const listRefundAuditLogs = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('refund_audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeRefundAudit);
};

export const openShiftSession = async ({ openedBy, openedByName, openedByRole, openingCash, notes }) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('open_shift_session', {
    p_opened_by: openedBy ?? null,
    p_opened_by_name: openedByName ?? null,
    p_opened_by_role: openedByRole ?? null,
    p_opening_cash: roundTo2(openingCash ?? 0),
    p_notes: notes ?? null,
  });

  if (error) throw error;

  await logSystemEvent({
    domain: 'orders',
    kind: 'correction',
    title: 'Shift Opened',
    detail: `Shift opened with starting cash of ₱${roundTo2(openingCash ?? 0).toFixed(2)}${openedByName ? ` by ${openedByName}` : ''}.`,
    entityId: data?.id ?? null,
    metadata: { openedBy, openedByName, openedByRole, openingCash: roundTo2(openingCash ?? 0), notes: notes ?? '' },
  });

  return normalizeShiftSession(data);
};

export const closeShiftSession = async ({ sessionId, expectedCash, countedCash, closedBy, closedByName, notes }) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('close_shift_session', {
    p_session_id: sessionId,
    p_expected_cash: expectedCash == null ? null : roundTo2(expectedCash),
    p_counted_cash: countedCash == null ? null : roundTo2(countedCash),
    p_closed_by: closedBy ?? null,
    p_closed_by_name: closedByName ?? null,
    p_notes: notes ?? null,
  });

  if (error) throw error;

  await logSystemEvent({
    domain: 'orders',
    kind: 'correction',
    title: 'Shift Closed',
    detail: `Shift closed${closedByName ? ` by ${closedByName}` : ''} with variance ₱${roundTo2(data?.variance ?? 0).toFixed(2)}.`,
    entityId: data?.id ?? sessionId,
    metadata: { expectedCash: data?.expected_cash ?? expectedCash ?? 0, countedCash: data?.counted_cash ?? countedCash ?? 0, variance: data?.variance ?? 0, notes: notes ?? '' },
  });

  return normalizeShiftSession(data);
};

export const logPaymentReconciliation = async ({ reportDate, cashSales, cashReceived, cashChange, ewalletSales, note, createdBy }) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('log_payment_reconciliation', {
    p_report_date: reportDate,
    p_cash_sales: roundTo2(cashSales ?? 0),
    p_cash_received: roundTo2(cashReceived ?? 0),
    p_cash_change: roundTo2(cashChange ?? 0),
    p_ewallet_sales: roundTo2(ewalletSales ?? 0),
    p_note: note ?? null,
    p_created_by: createdBy ?? null,
  });

  if (error) throw error;

  await logSystemEvent({
    domain: 'orders',
    kind: 'correction',
    title: 'Payment Reconciliation Logged',
    detail: `Daily reconciliation recorded for ${reportDate}. Cash variance: ₱${roundTo2(data?.variance ?? 0).toFixed(2)}.`,
    entityId: data?.id ?? reportDate,
    metadata: {
      reportDate,
      cashSales: data?.cash_sales ?? cashSales ?? 0,
      cashReceived: data?.cash_received ?? cashReceived ?? 0,
      cashChange: data?.cash_change ?? cashChange ?? 0,
      ewalletSales: data?.ewallet_sales ?? ewalletSales ?? 0,
      variance: data?.variance ?? 0,
      note: note ?? '',
    },
  });

  return normalizePaymentReconciliation(data);
};

export const logRefundAudit = async ({ orderId, orderNumber, amount, reason, processedBy, processedByName, note }) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('log_refund_audit', {
    p_order_id: orderId ?? null,
    p_order_number: orderNumber,
    p_amount: roundTo2(amount ?? 0),
    p_reason: reason,
    p_processed_by: processedBy ?? null,
    p_processed_by_name: processedByName ?? null,
    p_note: note ?? null,
  });

  if (error) throw error;

  await logSystemEvent({
    domain: 'orders',
    kind: 'correction',
    title: 'Refund Audit Logged',
    detail: `Refund audit recorded for order #${orderNumber} worth ₱${roundTo2(amount ?? 0).toFixed(2)}.`,
    entityId: data?.id ?? orderId ?? orderNumber,
    metadata: {
      orderId: orderId ?? null,
      orderNumber,
      amount: roundTo2(amount ?? 0),
      reason,
      processedBy: processedBy ?? null,
      processedByName: processedByName ?? null,
      note: note ?? '',
    },
  });

  return normalizeRefundAudit(data);
};