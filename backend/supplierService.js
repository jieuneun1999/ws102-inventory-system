import { createClient } from '@supabase/supabase-js';
import { sendApprovalEmail, sendRequestStatusEmail } from './mailer.js';

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

const normalizeLookupText = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeLookupId = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9._-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/(^-|-$)/g, '');

const stripIdPrefix = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/^(ing|ingredient|inv|inventory)-/, '');

const normalizeUnit = (value, fallback) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['g', 'kg', 'ml', 'l', 'pcs', 'units', 'bottles'].includes(normalized)) {
    return normalized === 'l' ? 'L' : normalized;
  }
  return fallback ?? null;
};

const resolveInventoryItem = async (itemName) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id,name,unit,category');

  if (error) {
    throw error;
  }

  const requestedRaw = String(itemName ?? '').trim();
  const requestedName = normalizeLookupText(itemName);
  const requestedId = normalizeLookupId(itemName);

  if (!requestedRaw) {
    return null;
  }

  const items = data ?? [];
  const exactIdMatch = items.find((item) => {
    const itemId = String(item.id ?? '').trim().toLowerCase();
    return itemId === requestedRaw.toLowerCase() || itemId === requestedId;
  });

  if (exactIdMatch) {
    return exactIdMatch;
  }

  const exactMatch = items.find((item) => normalizeLookupText(item.name) === requestedName);
  if (exactMatch) {
    return exactMatch;
  }

  const idPrefixMatch = items.find((item) => {
    const itemIdCore = stripIdPrefix(item.id);
    const requestIdCore = stripIdPrefix(requestedId || requestedRaw);
    return itemIdCore === requestIdCore;
  });

  if (idPrefixMatch) {
    return idPrefixMatch;
  }

  const looseMatch = items.find((item) => {
    const candidate = normalizeLookupText(item.name);
    return candidate.includes(requestedName) || requestedName.includes(candidate);
  });

  if (looseMatch) {
    return looseMatch;
  }

  const looseIdMatch = items.find((item) => {
    const itemIdCore = stripIdPrefix(item.id);
    const requestIdCore = stripIdPrefix(requestedId || requestedRaw);
    return itemIdCore.includes(requestIdCore) || requestIdCore.includes(itemIdCore);
  });

  return looseIdMatch ?? null;
};

const parseResolvedItemName = (itemName, resolvedItem) => {
  if (resolvedItem?.name) {
    return resolvedItem.name;
  }

  return String(itemName ?? '').trim();
};

export const normalizeSupplierRequest = (request) => ({
  id: request.id,
  itemName: request.item_name,
  inventoryItemId: request.inventory_item_id ?? null,
  inventoryItemName: request.inventory_item_name ?? null,
  quantity: request.quantity,
  unit: request.unit ?? null,
  supplierEmail: request.supplier_email,
  status: request.status,
  sourceUid: request.source_uid,
  createdAt: request.created_at,
  updatedAt: request.updated_at,
});

export const createSupplierRequest = async ({ itemName, quantity, unit, supplierEmail, sourceUid }) => {
  const supabase = getSupabaseClient();
  const resolvedItem = await resolveInventoryItem(itemName);
  const resolvedItemName = parseResolvedItemName(itemName, resolvedItem);
  const resolvedUnit = normalizeUnit(unit, resolvedItem?.unit ?? null);
  const payload = {
    item_name: resolvedItemName,
    inventory_item_id: resolvedItem?.id ?? null,
    inventory_item_name: resolvedItemName,
    quantity,
    unit: resolvedUnit,
    supplier_email: supplierEmail,
    status: 'pending',
    source_uid: sourceUid ?? null,
  };

  const query = sourceUid
    ? supabase.from('supplier_requests').upsert(payload, {
        onConflict: 'source_uid',
        ignoreDuplicates: true,
      })
    : supabase.from('supplier_requests').insert(payload);

  const { data, error } = await query.select();

  if (error) {
    throw error;
  }

  let row = Array.isArray(data) ? data[0] ?? null : data ?? null;

  if (!row && sourceUid) {
    const { data: existing, error: existingError } = await supabase
      .from('supplier_requests')
      .select('*')
      .eq('source_uid', sourceUid)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    row = existing ?? null;
  }

  if (!row) {
    throw new Error('Supplier request write returned no rows');
  }

  // Ensure supplier contact exists and is active so registry reflects working senders
  try {
    await supabase
      .from('supplier_contacts')
      .upsert({ email: supplierEmail, display_name: null, active: true, updated_at: new Date().toISOString() }, { onConflict: 'email' });
  } catch (err) {
    // don't fail request creation if contact upsert fails; just log
    console.warn('Failed to upsert supplier contact for', supplierEmail, err?.message ?? err);
  }

  return normalizeSupplierRequest(row);
};

export const listSupplierRequests = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('supplier_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(normalizeSupplierRequest);
};

export const listActiveSupplierEmails = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('supplier_contacts')
    .select('email,active')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => String(row.email ?? '').trim().toLowerCase())
    .filter(Boolean);
};

export const updateSupplierRequestStatus = async (requestId, status) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('supplier_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return normalizeSupplierRequest(data);
};

export const updateSupplierRequestStatusWithNotification = async (requestId, status) => {
  const normalizedStatus = String(status ?? '').toLowerCase();
  if (!['pending', 'approved', 'void'].includes(normalizedStatus)) {
    throw new Error('Invalid supplier request status');
  }

  const supabase = getSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from('supplier_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    throw new Error('Supplier request not found');
  }

  const { data: updated, error: updateError } = await supabase
    .from('supplier_requests')
    .update({ status: normalizedStatus, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .select()
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (!updated) {
    throw new Error('Failed to update supplier request status');
  }

  const shouldNotify = (normalizedStatus === 'approved' || normalizedStatus === 'void')
    && existing.status !== normalizedStatus;

  if (shouldNotify) {
    try {
      await sendRequestStatusEmail({
        to: updated.supplier_email,
        itemName: updated.item_name,
        quantity: updated.quantity,
        unit: updated.unit,
        status: normalizedStatus,
      });
    } catch (mailError) {
      console.warn('Failed to send supplier status email:', mailError?.message ?? mailError);
    }
  }

  return normalizeSupplierRequest(updated);
};

export const approveRequest = async (requestId) => {
  const supabase = getSupabaseClient();
  const { data: request, error: fetchError } = await supabase
    .from('supplier_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  const { data: updated, error: updateError } = await supabase
    .from('supplier_requests')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .select()
    .single();

  if (updateError) {
    throw updateError;
  }

  await sendApprovalEmail({
    to: request.supplier_email,
    itemName: request.item_name,
    quantity: request.quantity,
  });

  return normalizeSupplierRequest(updated);
};

export const listSupplierContacts = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('supplier_contacts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    email: String(row.email ?? '').trim().toLowerCase(),
    displayName: row.display_name ?? null,
    active: Boolean(row.active ?? true),
    notes: row.notes ?? null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
  }));
};

export const upsertSupplierContact = async ({ email, displayName, notes, active }) => {
  const supabase = getSupabaseClient();
  const payload = {
    email: String(email ?? '').trim().toLowerCase(),
    display_name: displayName ?? null,
    notes: notes ?? null,
    active: typeof active === 'boolean' ? active : true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('supplier_contacts')
    .upsert(payload, { onConflict: 'email' })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    email: String(data.email ?? '').trim().toLowerCase(),
    displayName: data.display_name ?? null,
    active: Boolean(data.active ?? true),
    notes: data.notes ?? null,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
    updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : undefined,
  };
};

// Helper: Create inventory adjustment on supplier request approval
export const createInventoryAdjustmentFromSupplierRequest = async (supplierRequest) => {
  const supabase = getSupabaseClient();
  const { inventory_item_id, inventory_item_name, quantity, unit } = supplierRequest;

  // Only create adjustment if we have a valid inventory item
  if (!inventory_item_id || !quantity) {
    return null;
  }

  const adjustmentPayload = {
    inventory_item_id,
    inventory_item_name: inventory_item_name || 'Unknown Item',
    type: 'batch_add', // Supplier batch addition
    delta: quantity,
    unit: unit || 'units',
    note: `Supplier request approved: ${quantity} ${unit || 'units'} of ${inventory_item_name}`,
  };

  try {
    const { data: adjustment, error } = await supabase
      .from('inventory_adjustments')
      .insert(adjustmentPayload)
      .select()
      .single();

    if (error) {
      console.warn('Failed to create inventory adjustment:', error?.message ?? error);
      return null;
    }

    // Auto-update inventory_items stock (increase it)
    // Fetch current stock to add quantity
    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('stock')
      .eq('id', inventory_item_id)
      .single();

    if (fetchError) {
      console.warn('Failed to fetch inventory item:', fetchError?.message ?? fetchError);
      return adjustment;
    }

    const newStock = (item?.stock ?? 0) + quantity;
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({
        stock: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventory_item_id);

    if (updateError) {
      console.warn('Failed to update inventory stock:', updateError?.message ?? updateError);
      return adjustment;
    }

    return adjustment;
  } catch (err) {
    console.warn('Error in createInventoryAdjustmentFromSupplierRequest:', err?.message ?? err);
    return null;
  }
};

// Helper: Log event to system_history_events
export const logSystemEvent = async ({ domain, kind, title, detail, entityId, metadata = {} }) => {
  const supabase = getSupabaseClient();
  const eventId = `event-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  try {
    const { data, error } = await supabase
      .from('system_history_events')
      .insert({
        id: eventId,
        domain,
        kind,
        title,
        detail,
        entity_id: entityId,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.warn('Failed to log system event:', error?.message ?? error);
      return null;
    }

    return data;
  } catch (err) {
    console.warn('Error in logSystemEvent:', err?.message ?? err);
    return null;
  }
};

// Enhanced approval function with automation
export const approveSupplierRequestWithAutomation = async (requestId) => {
  const normalizedStatus = 'approved';
  const supabase = getSupabaseClient();

  // Fetch existing request
  const { data: existing, error: existingError } = await supabase
    .from('supplier_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    throw new Error('Supplier request not found');
  }

  // Update status
  const { data: updated, error: updateError } = await supabase
    .from('supplier_requests')
    .update({ status: normalizedStatus, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .select()
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (!updated) {
    throw new Error('Failed to update supplier request status');
  }

  // Trigger inventory automation
  await createInventoryAdjustmentFromSupplierRequest(updated);

  // Send notification email
  try {
    const { sendRequestStatusEmail } = await import('./mailer.js');
    await sendRequestStatusEmail({
      to: updated.supplier_email,
      itemName: updated.item_name,
      quantity: updated.quantity,
      unit: updated.unit,
      status: normalizedStatus,
    });
  } catch (mailError) {
    console.warn('Failed to send approval email:', mailError?.message ?? mailError);
  }

  // Log event
  await logSystemEvent({
    domain: 'supplier_requests',
    kind: 'request_approved',
    title: 'Supplier Request Approved',
    detail: `Approved request for ${updated.quantity} ${updated.unit} of ${updated.item_name}. Inventory adjustment created automatically.`,
    entityId: requestId,
    metadata: {
      supplierEmail: updated.supplier_email,
      itemName: updated.item_name,
      quantity: updated.quantity,
      unit: updated.unit,
    },
  });

  return normalizeSupplierRequest(updated);
};

// Enhanced void function with automation
export const voidSupplierRequestWithReason = async (requestId, reason = '') => {
  const normalizedStatus = 'void';
  const supabase = getSupabaseClient();

  // Fetch existing request
  const { data: existing, error: existingError } = await supabase
    .from('supplier_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    throw new Error('Supplier request not found');
  }

  // Update status
  const { data: updated, error: updateError } = await supabase
    .from('supplier_requests')
    .update({ status: normalizedStatus, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .select()
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (!updated) {
    throw new Error('Failed to void supplier request');
  }

  // Send notification email
  try {
    const { sendRequestStatusEmail } = await import('./mailer.js');
    await sendRequestStatusEmail({
      to: updated.supplier_email,
      itemName: updated.item_name,
      quantity: updated.quantity,
      unit: updated.unit,
      status: normalizedStatus,
      reason: reason || undefined,
    });
  } catch (mailError) {
    console.warn('Failed to send void email:', mailError?.message ?? mailError);
  }

  // Log event with reason
  await logSystemEvent({
    domain: 'supplier_requests',
    kind: 'request_void',
    title: 'Supplier Request Voided',
    detail: `Voided request for ${updated.quantity} ${updated.unit} of ${updated.item_name}. Reason: ${reason || 'Not specified'}`,
    entityId: requestId,
    metadata: {
      supplierEmail: updated.supplier_email,
      itemName: updated.item_name,
      quantity: updated.quantity,
      unit: updated.unit,
      voidReason: reason || '',
    },
  });

  return normalizeSupplierRequest(updated);
};
