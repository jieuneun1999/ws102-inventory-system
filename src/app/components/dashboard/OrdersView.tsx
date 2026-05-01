import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  HandCoins,
  Package,
  Printer,
  ScanLine,
  Trash2,
  Wallet,
  X,
  Search,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from './ConfirmDialog';
import {
  useAppStore,
  type CartItem,
  type Order,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type Product,
  type Receipt,
  type SyncTrigger,
} from '../../store';
import { bootstrapSupabaseDemo, fetchPublicOrderBoard } from '../../lib/supabaseSync';
import { subscribeDashboardRealtime } from '../../lib/supabaseRealtime';

const STORAGE_KEY = 'aura-cafe-storage';
const MAX_VISIBLE_QUEUE_ORDERS = 3;

type DateFilter = 'today' | 'week' | 'all';

const COLUMNS: { id: OrderStatus; label: string; color: string; dotColor: string; bg: string }[] = [
  { id: 'pending', label: 'Pending Approval', color: 'text-amber-700', dotColor: 'bg-amber-400', bg: 'bg-amber-50/60' },
  { id: 'preparing', label: 'Now Preparing', color: 'text-[#4D0E13]', dotColor: 'bg-[#C8A49F]', bg: 'bg-[#C8A49F]/10' },
  { id: 'ready', label: 'Now Serving', color: 'text-emerald-700', dotColor: 'bg-emerald-400', bg: 'bg-emerald-50/60' },
  { id: 'completed', label: 'Completed', color: 'text-gray-500', dotColor: 'bg-gray-300', bg: 'bg-gray-50/60' },
];

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
  completed: null,
};

type DraftLine = {
  product: Product;
  quantity: number;
};

const formatPeso = (value: number) => `P ${value.toFixed(2)}`;

const escapeXml = (value: string) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildReceiptImageDataUrl = (receipt: Receipt) => {
  const safeReceiptNumber = escapeXml(receipt.receiptNumber);
  const safeOrderNumber = escapeXml(receipt.orderNumber);
  const safeOrderType = escapeXml(receipt.orderType.charAt(0).toUpperCase() + receipt.orderType.slice(1));
  const safePayment = escapeXml(receipt.paymentMethod === 'cash' ? 'Cash' : 'E-wallet / Online');
  const clampText = (value: string, maxLength: number) => {
    const text = String(value).trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
  };

  const rows = receipt.items
    .map(
      (item, idx) => {
        const y = 194 + idx * 24;
        return `
          <g>
            <text x="20" y="${y}" font-size="10.5" font-weight="600" font-family="Arial, sans-serif" fill="#2C2C2C">${escapeXml(`${item.quantity}x ${clampText(item.name, 28)}`)}</text>
            <text x="336" y="${y}" text-anchor="end" font-size="10.5" font-weight="600" font-family="Arial, sans-serif" fill="#2C2C2C">₱${item.lineTotal.toFixed(2)}</text>
          </g>
        `;
      }
    )
    .join('');

  const issuedDate = new Date(receipt.issuedAt).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const baseRowsY = 194 + receipt.items.length * 24;
  const totalsY = baseRowsY + 18;
  const paymentStartY = totalsY + 44;
  const footerY = paymentStartY + (receipt.paymentMethod === 'cash' ? 42 : 24);

  const paymentRows =
    receipt.paymentMethod === 'cash'
      ? `<text x="20" y="${paymentStartY}" font-size="10" font-family="Arial, sans-serif" fill="#6B6B6B">Cash Received</text>
        <text x="336" y="${paymentStartY}" text-anchor="end" font-size="10" font-weight="600" font-family="Arial, sans-serif" fill="#2C2C2C">₱${(receipt.cashReceived ?? 0).toFixed(2)}</text>
        <text x="20" y="${paymentStartY + 15}" font-size="10" font-family="Arial, sans-serif" fill="#6B6B6B">Change Due</text>
        <text x="336" y="${paymentStartY + 15}" text-anchor="end" font-size="10" font-weight="600" font-family="Arial, sans-serif" fill="#2C2C2C">₱${(receipt.changeDue ?? 0).toFixed(2)}</text>`
      : `<text x="20" y="${paymentStartY}" font-size="10" font-family="Arial, sans-serif" fill="#2F5D50">Payment Status</text>
        <text x="336" y="${paymentStartY}" text-anchor="end" font-size="10" font-weight="600" font-family="Arial, sans-serif" fill="#2F5D50">Paid</text>`;

  const h = Math.max(360, footerY + 34);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="360" height="${h}" viewBox="0 0 360 ${h}">
      <defs>
        <style>
          .label { font-family: Arial, sans-serif; font-size: 10px; letter-spacing: 1.2px; fill: #7B7B7B; }
          .value { font-family: Arial, sans-serif; font-size: 11px; fill: #2C2C2C; }
        </style>
      </defs>
      <rect width="360" height="${h}" rx="14" fill="#FFFFFF" stroke="#E5E1DB" />

      <text x="180" y="34" text-anchor="middle" font-size="21" font-family="Georgia, serif" font-weight="700" fill="#1F1F1F">Aura Cafe</text>
      <text x="180" y="49" text-anchor="middle" font-size="9.5" font-family="Arial, sans-serif" fill="#757575">Freshly brewed, made with care</text>

      <line x1="18" y1="60" x2="342" y2="60" stroke="#E6E1DA" stroke-width="1" />

      <text x="20" y="78" class="label">Receipt</text>
      <text x="20" y="92" class="value" font-weight="700">#${safeReceiptNumber}</text>
      <text x="132" y="78" class="label">Order</text>
      <text x="132" y="92" class="value" font-weight="700">#${safeOrderNumber}</text>
      <text x="230" y="78" class="label">Date</text>
      <text x="230" y="92" class="value" font-weight="700">${escapeXml(issuedDate)}</text>

      <line x1="18" y1="104" x2="342" y2="104" stroke="#E6E1DA" stroke-width="1" />

      <text x="20" y="121" class="value" fill="#4A4A4A">${safeOrderType}</text>
      <text x="92" y="121" class="value" fill="#4A4A4A">•</text>
      <text x="104" y="121" class="value" fill="#4A4A4A">${safePayment}</text>
      <text x="336" y="121" text-anchor="end" class="value" fill="#757575">Items: ${receipt.items.length}</text>

      <text x="20" y="146" class="label">ITEMS</text>
      ${rows}
      
      <line x1="18" y1="${baseRowsY + 2}" x2="342" y2="${baseRowsY + 2}" stroke="#E6E1DA" stroke-width="1" />

      <text x="20" y="${totalsY}" class="value" fill="#6B6B6B">Subtotal</text>
      <text x="336" y="${totalsY}" text-anchor="end" class="value" font-weight="700">₱${receipt.subtotal.toFixed(2)}</text>
      <text x="20" y="${totalsY + 18}" class="value" font-size="12" font-weight="700" fill="#1F1F1F">Total</text>
      <text x="336" y="${totalsY + 19}" text-anchor="end" font-size="18" font-family="Georgia, serif" font-weight="700" fill="#1F1F1F">₱${receipt.total.toFixed(2)}</text>
      
      ${paymentRows}
      
      <line x1="18" y1="${footerY - 4}" x2="342" y2="${footerY - 4}" stroke="#E6E1DA" stroke-width="1" />
      <text x="180" y="${footerY + 10}" text-anchor="middle" font-size="10.5" font-family="Arial, sans-serif" font-weight="700" fill="#1F1F1F">Thank you for choosing Aura Cafe</text>
      <text x="180" y="${footerY + 24}" text-anchor="middle" font-size="9" font-family="Arial, sans-serif" fill="#757575">Please come again</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

function OrderCard({
  order,
  onAdvance,
  onBack,
  onVoid,
}: {
  order: Order;
  onAdvance: (order: Order) => void;
  onBack: (order: Order) => void;
  onVoid: (order: Order) => void;
}) {
  const showBack = order.status === 'ready';

  return (
    <div
      key={order.id}
      className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
    >
      <div
        className={`h-1 w-full ${
          order.status === 'pending'
            ? 'bg-amber-400'
            : order.status === 'preparing'
            ? 'bg-[#C8A49F]'
            : order.status === 'ready'
            ? 'bg-emerald-400'
            : 'bg-gray-300'
        }`}
      />

      <div className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <h4 className="font-serif text-base text-[#4D0E13] font-medium">#{order.orderNumber}</h4>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                order.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {order.paymentMethod === 'cash' ? 'Cash' : 'E-wallet'}
            </span>
            {order.receiptNumber && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EADDD1] text-[#4D0E13]">
                {order.receiptNumber}
              </span>
            )}
          </div>
          <span className="text-[10px] text-[#4D0E13]/40 font-semibold">
            {new Date(order.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="space-y-1.5 mb-3">
          {order.items.slice(0, 3).map((item) => (
            <div key={`${order.id}-${item.cartItemId}`} className="flex justify-between items-center">
              <p className="text-sm text-[#4D0E13]/70 truncate">
                {item.quantity}x {item.name}
              </p>
              <p className="text-xs font-semibold text-[#4D0E13]/70">{formatPeso(item.price * item.quantity)}</p>
            </div>
          ))}
          {order.items.length > 3 && (
            <p className="text-[11px] text-[#4D0E13]/45">+{order.items.length - 3} more item(s)</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#D8C4AC]/25">
          <span className="font-serif text-base text-[#4D0E13]">{formatPeso(order.total)}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {showBack && (
              <button
                onClick={() => onBack(order)}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#F5EFE6] text-[#4D0E13] hover:bg-[#EADDD1]"
              >
                Back to Preparing
              </button>
            )}

            {order.status !== 'completed' ? (
              <button
                onClick={() => onAdvance(order)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold ${
                  order.status === 'pending'
                    ? 'bg-[#4D0E13] text-[#EEE4DA]'
                    : order.status === 'preparing'
                    ? 'bg-[#C8A49F] text-white'
                    : 'bg-emerald-500 text-white'
                }`}
              >
                {order.status === 'ready' ? <Check size={12} /> : <ArrowRight size={12} />}
                {order.status === 'pending'
                  ? 'Approve'
                  : order.status === 'preparing'
                  ? 'To Serving'
                  : 'Complete'}
              </button>
            ) : (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">Done</span>
            )}

            <button
              onClick={() => onVoid(order)}
              className="p-1.5 rounded-full text-red-700 bg-red-50 hover:bg-red-100"
              title="Void"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrdersView() {
  const orders = useAppStore((state) => state.orders);
  const products = useAppStore((state) => state.products);
  const getProductAvailability = useAppStore((state) => state.getProductAvailability);
  const clearedOrderIds = useAppStore((state) => state.clearedOrderIds);
  const clearCompletedOrders = useAppStore((state) => state.clearCompletedOrders);
  const updateOrderStatus = useAppStore((state) => state.updateOrderStatus);
  const deleteOrder = useAppStore((state) => state.deleteOrder);
  const createOrderFromItems = useAppStore((state) => state.createOrderFromItems);
  const approvePendingOrder = useAppStore((state) => state.approvePendingOrder);
  const hydrateRemoteData = useAppStore((state) => state.hydrateRemoteData);

  const [filter, setFilter] = useState<'all' | 'delivery' | 'pickup'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [draftOrderType, setDraftOrderType] = useState<OrderType>('pickup');
  const [draftPaymentMethod, setDraftPaymentMethod] = useState<PaymentMethod>('ewallet');
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  const [approvalTarget, setApprovalTarget] = useState<Order | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [armApproval, setArmApproval] = useState(false);

  const [receiptPreview, setReceiptPreview] = useState<{ receipt: Receipt; imageDataUrl: string } | null>(null);
  const latestOrdersRef = useRef<Order[]>(orders);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  useEffect(() => {
    latestOrdersRef.current = orders;
  }, [orders]);

  // Realtime subscription for order changes
  useEffect(() => {
    let active = true;
    let debounceTimer: number | null = null;
    let pollTimer: number | null = null;
    let requestSequence = 0;

    const syncDashboardSnapshot = async (source: SyncTrigger = 'initial') => {
      const requestId = ++requestSequence;
      const snapshot = await bootstrapSupabaseDemo().catch(() => null);
      if (!active || requestId !== requestSequence) return;

      if (snapshot) {
        hydrateRemoteData({
          orders: snapshot.orders,
          receipts: snapshot.receipts,
          inventory: snapshot.inventory,
          inventoryAdjustments: snapshot.inventoryAdjustments,
          wasteLogs: snapshot.wasteLogs,
        }, { source });
        return;
      }

      // Fallback: still refresh order queue from public order board to avoid stale pending list.
      const publicOrders = await fetchPublicOrderBoard().catch(() => null);
      if (!publicOrders || !active || requestId !== requestSequence) return;

      const existingById = new Map(latestOrdersRef.current.map((order) => [order.id, order]));
      const mergedOrders = publicOrders.map((entry) => {
        const existing = existingById.get(entry.id);
        if (existing) {
          return {
            ...existing,
            status: entry.status,
            total: entry.total,
            estimatedTime: entry.estimatedTime,
            createdAt: entry.createdAt,
            orderType: entry.orderType,
            paymentMethod: entry.paymentMethod,
          };
        }

        return {
          id: entry.id,
          orderNumber: entry.orderNumber,
          status: entry.status,
          items: [],
          total: entry.total,
          createdAt: entry.createdAt,
          estimatedTime: entry.estimatedTime,
          orderType: entry.orderType,
          paymentMethod: entry.paymentMethod,
        };
      });

      hydrateRemoteData({ orders: mergedOrders }, { source });
    };

    const scheduleSync = (source: SyncTrigger) => {
      if (!active) return;
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        void syncDashboardSnapshot(source);
      }, source === 'realtime' ? 220 : 160);
    };

    const unsubscribe = subscribeDashboardRealtime(() => {
      if (active) {
        scheduleSync('realtime');
      }
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      scheduleSync('storage');
    };

    void syncDashboardSnapshot('initial');
    pollTimer = window.setInterval(() => {
      scheduleSync('interval');
    }, 15000);
    window.addEventListener('storage', onStorage);

    return () => {
      active = false;
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
      }
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
      window.removeEventListener('storage', onStorage);
      unsubscribe();
    };
  }, [hydrateRemoteData]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setApprovalTarget(null);
      setArmApproval(false);
      setCashReceived('');
      setReceiptPreview(null);
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const filteredOrders = useMemo(() => {
    let result = filter === 'all' ? orders : orders.filter((order) => order.orderType === filter);

    if (statusFilter !== 'all') {
      result = result.filter((order) => order.status === statusFilter);
    }

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const cutoff = dateFilter === 'today' ? now - oneDayMs : dateFilter === 'week' ? now - weekMs : 0;
    result = result.filter((order) => order.createdAt >= cutoff);

    if (deferredSearchQuery) {
      result = result.filter((order) => {
        if (order.orderNumber.toLowerCase().includes(deferredSearchQuery)) return true;
        return order.items.some((item) => item.name.toLowerCase().includes(deferredSearchQuery));
      });
    }

    return result;
  }, [dateFilter, deferredSearchQuery, filter, orders, statusFilter]);

  const orderBuckets = useMemo(() => ({
    pending: filteredOrders.filter((order) => order.status === 'pending'),
    preparing: filteredOrders.filter((order) => order.status === 'preparing'),
    ready: filteredOrders.filter((order) => order.status === 'ready'),
    completed: filteredOrders.filter((order) => order.status === 'completed'),
  }), [filteredOrders]);

  const completedOrders = useMemo(
    () => orderBuckets.completed.filter((order) => !clearedOrderIds.includes(order.id)),
    [clearedOrderIds, orderBuckets.completed]
  );
  const clearedOrders = useMemo(
    () => orderBuckets.completed.filter((order) => clearedOrderIds.includes(order.id)),
    [clearedOrderIds, orderBuckets.completed]
  );
  const pendingCount = useMemo(() => orders.filter((order) => order.status === 'pending').length, [orders]);

  const draftTotal = useMemo(
    () => draftLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [draftLines]
  );

  const visibleOrdersByStatus = useMemo(() => ({
    pending: orderBuckets.pending,
    preparing: orderBuckets.preparing,
    ready: orderBuckets.ready,
    completed: completedOrders,
  }), [completedOrders, orderBuckets.pending, orderBuckets.preparing, orderBuckets.ready]);

  const cashValue = Number(cashReceived || 0);
  const cashChange = approvalTarget ? Math.max(0, cashValue - approvalTarget.total) : 0;
  const cashInsufficient = Boolean(
    approvalTarget && approvalTarget.paymentMethod === 'cash' && (Number.isNaN(cashValue) || cashValue < approvalTarget.total)
  );

  const addDraftProduct = (product: Product) => {
    if (getProductAvailability(product.id).isOutOfStock) {
      toast.error(`${product.name} is out of stock.`);
      return;
    }

    setDraftLines((prev) => {
      const index = prev.findIndex((line) => line.product.id === product.id);
      if (index === -1) return [...prev, { product, quantity: 1 }];
      return prev.map((line, lineIndex) =>
        lineIndex === index ? { ...line, quantity: line.quantity + 1 } : line
      );
    });
  };

  const addByBarcode = () => {
    const code = barcodeInput.trim();
    if (!code) return;

    const product = products.find(
      (item) =>
        String(item.barcode ?? '').trim().toLowerCase() === code.toLowerCase() ||
        item.id.toLowerCase() === code.toLowerCase()
    );

    if (!product) {
      toast.error('No product found for this barcode.');
      return;
    }

    if (getProductAvailability(product.id).isOutOfStock) {
      toast.error(`${product.name} is out of stock.`);
      return;
    }

    addDraftProduct(product);
    setBarcodeInput('');
    toast.success(`${product.name} added to transaction.`);
  };

  const checkoutDraft = () => {
    if (draftLines.length === 0) {
      toast.error('Add at least one item to create a transaction.');
      return;
    }

    const items: CartItem[] = draftLines.map((line) => ({
      ...line.product,
      cartItemId: `pos_${line.product.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      basePrice: line.product.price,
      price: line.product.price,
      quantity: line.quantity,
      customization: undefined,
    }));

    const orderId = createOrderFromItems(items, draftOrderType, draftPaymentMethod);
    if (!orderId) {
      toast.error('Unable to create transaction. One or more items are out of stock.');
      return;
    }

    setDraftLines([]);
    toast.success('Transaction created and queued in Pending Approval.');
  };

  const handleAdvance = (order: Order) => {
    if (order.status === 'pending') {
      setApprovalTarget(order);
      setArmApproval(false);
      setCashReceived(order.paymentMethod === 'cash' ? order.total.toFixed(2) : '');
      return;
    }

    const next = NEXT_STATUS[order.status];
    if (!next) return;
    updateOrderStatus(order.id, next);
    toast.success(`Order #${order.orderNumber} moved to ${next}.`);
  };

  const handleBack = (order: Order) => {
    if (order.status !== 'ready') return;
    updateOrderStatus(order.id, 'preparing');
    toast.info(`Order #${order.orderNumber} moved back to preparing.`);
  };

  const handleVoid = (order: Order) => {
    setConfirmDialog({
      open: true,
      title: `Void Order #${order.orderNumber}`,
      message: 'This will permanently remove the order and its receipt from the queue.',
      onConfirm: () => {
        deleteOrder(order.id);
        toast.warning(`Order #${order.orderNumber} voided.`);
      },
    });
  };

  const confirmApproval = () => {
    if (!approvalTarget) return;

    if (!armApproval) {
      setArmApproval(true);
      toast.info('Tap Approve again to confirm this transaction.');
      return;
    }

    if (approvalTarget.paymentMethod === 'cash' && cashInsufficient) {
      toast.error('Cash amount is insufficient.');
      return;
    }

    const cashOption = approvalTarget.paymentMethod === 'cash' ? { cashReceived: Number(cashReceived || 0) } : undefined;
    const receipt = approvePendingOrder(approvalTarget.id, cashOption);
    const finalReceipt = receipt ?? useAppStore.getState().getReceipt(approvalTarget.id);
    if (!finalReceipt) {
      toast.error('Order approval failed.');
      return;
    }

    setReceiptPreview({
      receipt: finalReceipt,
      imageDataUrl: buildReceiptImageDataUrl(finalReceipt),
    });

    toast.success(`Order #${approvalTarget.orderNumber} approved. Receipt ${finalReceipt.receiptNumber} generated.`);
    setApprovalTarget(null);
    setArmApproval(false);
    setCashReceived('');
  };

  const printReceiptImage = () => {
    if (!receiptPreview) return;
    const popup = window.open('', '_blank', 'width=460,height=760');
    if (!popup) return;

    popup.document.write(`
      <html>
        <head><title>Receipt ${receiptPreview.receipt.receiptNumber}</title></head>
        <body style="margin:0;padding:20px;background:#f8fafc;display:flex;justify-content:center;">
          <img src="${receiptPreview.imageDataUrl}" style="width:420px;max-width:100%;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,0.12);" />
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-3xl md:text-4xl font-serif text-[#4D0E13] tracking-tight">POS Queue</h2>
            {pendingCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200"
              >
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                {pendingCount} awaiting approval
              </motion.span>
            )}
          </div>
          <p className="text-[#4D0E13]/60 font-medium text-sm">Approve pending transactions to finalize payment, generate a receipt image, and deduct stock.</p>
        </div>

        <div className="flex gap-1.5 bg-white/50 border border-[#D8C4AC]/30 rounded-full p-1 backdrop-blur-md">
          {(['all', 'pickup', 'delivery'] as const).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all capitalize ${
                filter === item ? 'bg-[#4D0E13] text-[#EEE4DA] shadow-sm' : 'text-[#4D0E13]/60 hover:text-[#4D0E13]'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="mb-4 flex flex-col gap-3">
        {/* Search Input */}
        <div className="flex items-center gap-2 bg-white/50 border border-[#D8C4AC]/30 rounded-xl px-3.5 py-2.5 backdrop-blur-md">
          <Search size={16} className="text-[#4D0E13]/60" />
          <input
            type="text"
            placeholder="Search by order number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#4D0E13] placeholder-[#4D0E13]/40 outline-none"
          />
        </div>

        {/* Status and Date Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Status Filter */}
          <div className="flex flex-wrap gap-2 bg-white/50 border border-[#D8C4AC]/30 rounded-xl p-2 backdrop-blur-md">
            {(['all', 'pending', 'preparing', 'ready', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all capitalize ${
                  statusFilter === status
                    ? status === 'pending'
                      ? 'bg-amber-400 text-amber-900'
                      : status === 'preparing'
                      ? 'bg-[#C8A49F] text-white'
                      : status === 'ready'
                      ? 'bg-emerald-400 text-emerald-900'
                      : status === 'completed'
                      ? 'bg-gray-400 text-gray-900'
                      : 'bg-[#4D0E13] text-[#EEE4DA]'
                    : 'bg-white text-[#4D0E13]/70 border border-[#D8C4AC]/20'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2 bg-white/50 border border-[#D8C4AC]/30 rounded-xl p-2 backdrop-blur-md">
            <Calendar size={16} className="text-[#4D0E13]/60 ml-1" />
            {(['today', 'week', 'all'] as const).map((dateOpt) => (
              <button
                key={dateOpt}
                onClick={() => setDateFilter(dateOpt)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all capitalize flex-1 ${
                  dateFilter === dateOpt
                    ? 'bg-[#4D0E13] text-[#EEE4DA]'
                    : 'bg-white text-[#4D0E13]/70 border border-[#D8C4AC]/20'
                }`}
              >
                {dateOpt === 'today' ? 'Today' : dateOpt === 'week' ? 'This Week' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        <div className="xl:col-span-2 bg-white/65 border border-[#D8C4AC]/35 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ScanLine size={16} className="text-[#4D0E13]/70" />
            <h3 className="font-serif text-lg text-[#4D0E13]">Barcode Transaction Entry</h3>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addByBarcode();
                }
              }}
              placeholder="Scan/input barcode or product ID"
              className="flex-1 bg-white/70 border border-[#D8C4AC]/50 rounded-xl px-4 py-2.5 text-sm text-[#4D0E13]"
            />
            <button onClick={addByBarcode} className="px-4 py-2.5 rounded-xl bg-[#4D0E13] text-[#EEE4DA] text-sm font-bold">
              Add by Code
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto pr-1 space-y-2">
            {draftLines.length === 0 ? (
              <p className="text-xs text-[#4D0E13]/45">No items in current transaction.</p>
            ) : (
              draftLines.map((line) => (
                <div key={line.product.id} className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2 border border-[#D8C4AC]/30">
                  <div>
                    <p className="text-sm font-semibold text-[#4D0E13]">{line.product.name}</p>
                    <p className="text-[11px] text-[#4D0E13]/55">Barcode: {line.product.barcode || 'N/A'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setDraftLines((prev) =>
                          prev
                            .map((entry) =>
                              entry.product.id === line.product.id
                                ? { ...entry, quantity: Math.max(0, entry.quantity - 1) }
                                : entry
                            )
                            .filter((entry) => entry.quantity > 0)
                        )
                      }
                      className="px-2 py-1 text-xs rounded bg-[#F5EFE6] text-[#4D0E13]"
                    >
                      -
                    </button>
                    <span className="text-sm font-bold text-[#4D0E13] min-w-5 text-center">{line.quantity}</span>
                    <button
                      onClick={() =>
                        setDraftLines((prev) =>
                          prev.map((entry) =>
                            entry.product.id === line.product.id
                              ? { ...entry, quantity: entry.quantity + 1 }
                              : entry
                          )
                        )
                      }
                      className="px-2 py-1 text-xs rounded bg-[#F5EFE6] text-[#4D0E13]"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3 items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setDraftOrderType('pickup')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  draftOrderType === 'pickup' ? 'bg-[#4D0E13] text-[#EEE4DA]' : 'bg-white text-[#4D0E13]/70'
                }`}
              >
                Pickup
              </button>
              <button
                onClick={() => setDraftOrderType('delivery')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  draftOrderType === 'delivery' ? 'bg-[#4D0E13] text-[#EEE4DA]' : 'bg-white text-[#4D0E13]/70'
                }`}
              >
                Delivery
              </button>
            </div>

            <div className="flex gap-2 lg:justify-center">
              <button
                onClick={() => setDraftPaymentMethod('cash')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                  draftPaymentMethod === 'cash' ? 'bg-emerald-600 text-white' : 'bg-white text-[#4D0E13]/70'
                }`}
              >
                <HandCoins size={12} /> Cash
              </button>
              <button
                onClick={() => setDraftPaymentMethod('ewallet')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                  draftPaymentMethod === 'ewallet' ? 'bg-blue-600 text-white' : 'bg-white text-[#4D0E13]/70'
                }`}
              >
                <Wallet size={12} /> E-wallet
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-serif text-[#4D0E13]">{formatPeso(draftTotal)}</span>
              <button onClick={checkoutDraft} className="px-4 py-2 rounded-full bg-[#4D0E13] text-[#EEE4DA] text-xs font-bold">
                Queue Pending
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/65 border border-[#D8C4AC]/35 rounded-2xl p-4">
          <h3 className="font-serif text-lg text-[#4D0E13] mb-2">Products + Barcode</h3>
          <p className="text-xs text-[#4D0E13]/55 mb-3">Quick reference for manual code input.</p>
          <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
            {products.slice(0, 18).map((product) => (
              <button
                key={product.id}
                onClick={() => addDraftProduct(product)}
                className="w-full text-left bg-white/60 border border-[#D8C4AC]/25 rounded-xl px-3 py-2 hover:bg-white"
              >
                <p className="text-sm font-semibold text-[#4D0E13]">{product.name}</p>
                <p className="text-[11px] text-[#4D0E13]/55">{product.barcode || product.id}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
          <div className="w-24 h-24 bg-[#D8C4AC]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package size={36} className="text-[#4D0E13]/30" />
          </div>
          <h3 className="font-serif text-2xl text-[#4D0E13]/60 mb-2">No queued transactions</h3>
          <p className="text-[#4D0E13]/40 text-sm max-w-xs">Use the barcode panel above to create a pending transaction.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 flex-1 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 min-h-0">
            {COLUMNS.map((col) => {
              const colOrders = visibleOrdersByStatus[col.id];
              const shouldCapColumn = col.id === 'pending' || col.id === 'preparing' || col.id === 'ready';
              const visibleOrders = shouldCapColumn ? colOrders.slice(0, MAX_VISIBLE_QUEUE_ORDERS) : colOrders;
              const hiddenCount = shouldCapColumn ? Math.max(0, colOrders.length - visibleOrders.length) : 0;

              return (
                <div key={col.id} className="flex flex-col gap-3">
                  <div className={`flex items-center justify-between px-3 sm:px-4 py-2.5 rounded-xl ${col.bg} border border-white/40`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                      <h3 className={`font-serif text-sm ${col.color} font-medium`}>{col.label}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${col.color} bg-white/60`}>
                        {colOrders.length}
                      </span>
                      {col.id === 'completed' && completedOrders.length > 0 && (
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              open: true,
                              title: `Clear ${completedOrders.length} Completed Order(s)`,
                              message: 'Cleared orders will be moved out of the completed column.',
                              onConfirm: () => {
                                clearCompletedOrders();
                                toast.success(`${completedOrders.length} completed order(s) moved to Cleared.`);
                              },
                            });
                          }}
                          className="px-2 py-1 rounded-full text-[10px] font-bold bg-[#4D0E13] text-[#EEE4DA]"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-1 max-h-[60vh] lg:max-h-[calc(100vh-340px)]">
                    {colOrders.length === 0 ? (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-24 rounded-xl border-2 border-dashed border-[#D8C4AC]/25 flex items-center justify-center">
                        <p className="text-[10px] font-semibold text-[#4D0E13]/25">No orders</p>
                      </motion.div>
                    ) : (
                      visibleOrders.map((order) => (
                        <OrderCard key={order.id} order={order} onAdvance={handleAdvance} onBack={handleBack} onVoid={handleVoid} />
                      ))
                    )}

                    {hiddenCount > 0 && (
                      <div className="rounded-xl border border-dashed border-[#D8C4AC]/45 bg-white/55 px-3 py-2 text-center">
                        <p className="text-[11px] font-semibold text-[#4D0E13]/60">... +{hiddenCount} more in queue</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-[#D8C4AC]/35 bg-white/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Archive size={14} className="text-[#4D0E13]/70" />
                <h3 className="font-serif text-base text-[#4D0E13]">Cleared</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-[#4D0E13]/70 bg-[#F5EFE6]">{clearedOrders.length}</span>
            </div>

            {clearedOrders.length === 0 ? (
              <p className="text-xs text-[#4D0E13]/45">No cleared orders yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {clearedOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-[#D8C4AC]/25 bg-white/65 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#4D0E13]">#{order.orderNumber}</p>
                      <p className="text-[10px] text-[#4D0E13]/50">{formatPeso(order.total)}</p>
                    </div>
                    <p className="text-[11px] text-[#4D0E13]/60 mt-1 truncate">
                      {order.items.length} item(s) • {new Date(order.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {approvalTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => {
                setApprovalTarget(null);
                setArmApproval(false);
                setCashReceived('');
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1.5rem)] sm:w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white/92 backdrop-blur-2xl border border-white/70 rounded-[1.5rem] shadow-2xl z-50 p-5 sm:p-7"
            >
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} className="text-amber-600" />
                <h3 className="text-2xl font-serif text-[#4D0E13]">Approve Pending Transaction</h3>
              </div>
              <p className="text-sm text-[#4D0E13]/65 mb-4">
                Cashier/barista final step: confirm payment, approve transaction, then review generated receipt image.
              </p>

              <div className="rounded-xl border border-[#D8C4AC]/35 bg-white/60 p-3 mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#4D0E13]/50 mb-2">Order #{approvalTarget.orderNumber}</p>
                <div className="space-y-1.5">
                  {approvalTarget.items.map((item) => (
                    <div key={`${approvalTarget.id}-${item.cartItemId}`} className="flex justify-between text-sm text-[#4D0E13]/75">
                      <span>{item.quantity}x {item.name}</span>
                      <span>{formatPeso(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-[#D8C4AC]/30 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#4D0E13]">Total</span>
                  <span className="font-serif text-[#4D0E13]">{formatPeso(approvalTarget.total)}</span>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#D8C4AC]/35 bg-white/65 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#4D0E13]/45 mb-1">Payment Method</p>
                  <p className="text-sm font-semibold text-[#4D0E13] inline-flex items-center gap-1.5">
                    {approvalTarget.paymentMethod === 'cash' ? <HandCoins size={14} /> : <Wallet size={14} />}
                    {approvalTarget.paymentMethod === 'cash' ? 'Cash' : 'Online / E-wallet'}
                  </p>
                </div>

                {approvalTarget.paymentMethod === 'cash' ? (
                  <div className="rounded-xl border border-[#D8C4AC]/35 bg-white/65 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#4D0E13]/45 mb-1">Cash Received</p>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashReceived}
                      onChange={(e) => {
                        setCashReceived(e.target.value);
                        setArmApproval(false);
                      }}
                      className="w-full bg-white/75 border border-[#D8C4AC]/45 rounded-lg px-3 py-2 text-sm text-[#4D0E13]"
                    />
                    <p className={`mt-1 text-[11px] font-semibold ${cashInsufficient ? 'text-red-600' : 'text-emerald-700'}`}>
                      {cashInsufficient ? 'Insufficient cash amount.' : `Change: ${formatPeso(cashChange)}`}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">Online Status</p>
                    <p className="text-sm font-semibold text-blue-700 inline-flex items-center gap-1.5">
                      <CreditCard size={14} /> Awaiting admin approval
                    </p>
                  </div>
                )}
              </div>

              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-700 font-semibold">
                  Double confirmation required: click Approve once to arm confirmation, then click again to finalize.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setApprovalTarget(null);
                    setArmApproval(false);
                    setCashReceived('');
                  }}
                  className="flex-1 px-5 py-3 rounded-full border border-[#D8C4AC]/50 bg-white/70 text-[#4D0E13] font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmApproval}
                  disabled={approvalTarget.paymentMethod === 'cash' && cashInsufficient}
                  className="flex-1 px-5 py-3 rounded-full bg-[#4D0E13] text-[#EEE4DA] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-55"
                >
                  <CheckCircle2 size={16} /> {armApproval ? 'Confirm Approval' : 'Approve Transaction'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {receiptPreview && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50"
              onClick={() => setReceiptPreview(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1.5rem)] sm:w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#FFFDF9]/98 border border-[#E7E1D9] rounded-[1.35rem] shadow-[0_22px_60px_rgba(31,31,31,0.12)] z-50 p-4 sm:p-5"
            >
              <div className="flex items-center justify-between mb-4 gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-serif text-[#4D0E13]">Generated Receipt</h3>
                  <span className="text-xs font-bold text-[#4D0E13]/60 bg-[#F5EFE6] px-2.5 py-1 rounded-full">
                    {receiptPreview.receipt.receiptNumber}
                  </span>
                </div>
                <button
                  onClick={() => setReceiptPreview(null)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-[#D8C4AC]/50 text-[#4D0E13] bg-white hover:bg-[#F5EFE6]"
                  aria-label="Close receipt preview"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="rounded-[1rem] border border-[#E7E1D9] bg-white p-3 sm:p-4 mb-4">
                <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7B7B7B]">
                  <span>Preview</span>
                  <span>Receipt</span>
                </div>
                <div className="flex justify-center">
                  <img
                    src={receiptPreview.imageDataUrl}
                    alt="Receipt Preview"
                    className="block w-full max-w-[340px] h-auto object-contain mx-auto rounded-[0.9rem] border border-[#E7E1D9] bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setReceiptPreview(null)}
                  className="flex-1 px-5 py-3 rounded-full border border-[#D8C4AC]/50 bg-white text-[#4D0E13] font-bold"
                >
                  Close
                </button>
                <a
                  href={receiptPreview.imageDataUrl}
                  download={`${receiptPreview.receipt.receiptNumber}.svg`}
                  className="flex-1 px-5 py-3 rounded-full border border-[#D8C4AC]/50 bg-white text-[#4D0E13] font-bold text-center"
                >
                  Download Image
                </a>
                <button
                  onClick={printReceiptImage}
                  className="flex-1 px-5 py-3 rounded-full bg-[#4D0E13] text-[#EEE4DA] font-bold inline-flex items-center justify-center gap-2"
                >
                  <Printer size={16} /> Print Receipt
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}
        onConfirm={() => {
          confirmDialog.onConfirm?.();
          setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
        }}
      />
    </div>
  );
}
