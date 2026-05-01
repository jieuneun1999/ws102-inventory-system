import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  requireAcknowledge?: boolean;
  acknowledgeLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  requireAcknowledge = true,
  acknowledgeLabel = 'I understand this action cannot be undone.',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!open) {
      setAcknowledged(false);
    }
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[220]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={onCancel}
          />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="absolute top-1/2 left-1/2 z-[221] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-red-200 bg-white p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700">
                <AlertTriangle size={16} />
              </span>
              <div>
                <h3 className="text-lg font-serif text-[#4D0E13]">{title}</h3>
                <p className="text-sm text-[#4D0E13]/70 mt-1">{message}</p>
              </div>
            </div>

            {requireAcknowledge && (
              <label className="mb-4 mt-2 flex items-start gap-2 rounded-xl border border-[#D8C4AC]/45 bg-[#F5EFE6]/65 p-3">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-xs font-medium text-[#4D0E13]/75">{acknowledgeLabel}</span>
              </label>
            )}

            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 rounded-full border border-[#D8C4AC]/55 bg-white px-4 py-2 text-sm font-bold text-[#4D0E13]"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={requireAcknowledge && !acknowledged}
                className="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
