import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  DRINK_ADD_ONS,
  SUGAR_LEVEL_OPTIONS,
  type Product,
  type CartItem,
  type DrinkCustomization,
  type DrinkSize,
} from '../store';

type DrinkCustomizationModalProps = {
  open: boolean;
  item?: CartItem | null;
  product?: Product | null;
  onClose: () => void;
  onSave: (customization: DrinkCustomization) => void;
  confirmLabel?: string;
};

const DEFAULT_CUSTOMIZATION: DrinkCustomization = {
  size: 'medium',
  sugarLevel: 100,
  addOnIds: [],
};

const SIZE_LABELS: Record<DrinkSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

const sizeSurcharge = (size: DrinkSize) => {
  if (size === 'large') return 30;
  if (size === 'medium') return 15;
  return 0;
};

export function DrinkCustomizationModal({ item, product, open, onClose, onSave, confirmLabel = 'Save customizations' }: DrinkCustomizationModalProps) {
  const [draft, setDraft] = useState<DrinkCustomization>(DEFAULT_CUSTOMIZATION);
  const sourceName = item?.name ?? product?.name ?? 'Customize Drink';
  const basePrice = item?.basePrice ?? product?.price ?? 0;

  useEffect(() => {
    if ((!item && !product) || !open) return;
    setDraft(
      item?.customization ?? {
        ...DEFAULT_CUSTOMIZATION,
      }
    );
  }, [item, product, open]);

  if (!open || (!item && !product)) return null;

  const addOnTotal = draft.addOnIds.reduce((sum, addOnId) => {
    const addOn = DRINK_ADD_ONS.find((entry) => entry.id === addOnId);
    return sum + (addOn?.price ?? 0);
  }, 0);
  const unitPrice = basePrice + sizeSurcharge(draft.size) + addOnTotal;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[#2e0f12]/28 backdrop-blur-[1.5px] px-3 pt-24 pb-4 sm:px-4 sm:pt-28 sm:pb-6">
      <div className="flex h-auto max-h-[calc(100vh-7.5rem)] w-full max-w-[390px] flex-col overflow-hidden rounded-[1.7rem] border border-white/55 bg-gradient-to-b from-white/90 via-[#faf6f0]/90 to-[#efe2d2]/90 shadow-[0_24px_72px_rgba(31,8,10,0.28)] backdrop-blur-2xl sm:max-h-[calc(100vh-8rem)] sm:max-w-[420px]">
        <div className="flex items-start justify-between gap-4 border-b border-[#D8C4AC]/55 px-4 pt-4 pb-3.5 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            <h3 className="font-serif text-[1.35rem] leading-tight text-[#4D0E13] sm:text-[1.55rem]">Customize Drink</h3>
            <p className="mt-1 truncate text-sm text-[#4D0E13]/65">{sourceName}</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="rounded-[1rem] border border-[#D8C4AC]/70 bg-white/82 px-3 py-2 text-right shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4D0E13]/45">Base price</p>
              <p className="font-serif text-[0.98rem] font-bold leading-none text-[#4D0E13]">PHP {basePrice.toFixed(2)}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-white/60 bg-white/65 p-2 text-[#4D0E13]/60 transition-colors hover:bg-white hover:text-[#4D0E13]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3.5 sm:px-5">
          <section className="rounded-[1.2rem] border border-[#E5D6C3] bg-white/78 p-3.5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-[15px] font-semibold text-[#4D0E13]">Choose Your Size:</h4>
              <span className="rounded-full bg-[#4D0E13] px-3 py-1 text-[11px] font-semibold text-[#F5EFE6] shadow-sm">Completed</span>
            </div>
            <div className="space-y-3">
              {(['small', 'medium', 'large'] as DrinkSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setDraft((prev) => ({ ...prev, size }))}
                  className="flex w-full items-center gap-4 rounded-2xl px-1 py-1 text-left transition-colors hover:bg-[#f8f1e7]"
                >
                  <span
                    className={`h-5 w-5 shrink-0 rounded-full border-2 transition-all ${
                      draft.size === size
                        ? 'border-[#4D0E13] bg-[#4D0E13] shadow-[inset_0_0_0_4px_white]'
                        : 'border-[#B9B0A3] bg-white'
                    }`}
                  />
                  <span className="flex-1 text-[15px] text-[#4D0E13]">{SIZE_LABELS[size]}</span>
                  <span className="text-[15px] font-medium text-[#4D0E13]">+{sizeSurcharge(size).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[1.2rem] border border-[#E5D6C3] bg-white/78 p-3.5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-[15px] font-semibold text-[#4D0E13]">Sugar Level:</h4>
              <span className="rounded-full bg-[#f0f0f0] px-3 py-1 text-[11px] font-semibold text-[#666]">Optional, choose 1</span>
            </div>
            <div className="space-y-3">
              {SUGAR_LEVEL_OPTIONS.map((level) => (
                <button
                  key={level}
                  onClick={() => setDraft((prev) => ({ ...prev, sugarLevel: level }))}
                  className="flex w-full items-center gap-4 rounded-2xl px-1 py-1 text-left transition-colors hover:bg-[#f8f1e7]"
                >
                  <span
                    className={`h-5 w-5 shrink-0 rounded-full border-2 transition-all ${
                      draft.sugarLevel === level
                        ? 'border-[#4D0E13] bg-[#4D0E13] shadow-[inset_0_0_0_4px_white]'
                        : 'border-[#B9B0A3] bg-white'
                    }`}
                  />
                  <span className="flex-1 text-[15px] text-[#4D0E13]">{level}%</span>
                  <span className="text-[15px] font-medium text-[#4D0E13]/90">Included</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[1.2rem] border border-[#E5D6C3] bg-white/78 p-3.5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-[15px] font-semibold text-[#4D0E13]">Add-ons:</h4>
              <span className="rounded-full bg-[#f0f0f0] px-3 py-1 text-[11px] font-semibold text-[#666]">Optional, multiple</span>
            </div>
            <div className="space-y-2.5">
              {DRINK_ADD_ONS.map((addOn) => {
                const selected = draft.addOnIds.includes(addOn.id);
                return (
                  <button
                    key={addOn.id}
                    onClick={() => {
                      setDraft((prev) => ({
                        ...prev,
                        addOnIds: selected
                          ? prev.addOnIds.filter((id) => id !== addOn.id)
                          : [...prev.addOnIds, addOn.id],
                      }));
                    }}
                    className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-all ${
                      selected
                        ? 'border-[#4D0E13]/25 bg-[#f2e8dd] shadow-[0_10px_20px_rgba(77,14,19,0.08)]'
                        : 'border-[#E6D8C8] bg-white/80 hover:bg-[#faf6ef]'
                    }`}
                  >
                    <span
                      className={`h-5 w-5 shrink-0 rounded-full border-2 transition-all ${
                        selected
                          ? 'border-[#4D0E13] bg-[#4D0E13] shadow-[inset_0_0_0_4px_white]'
                          : 'border-[#B9B0A3] bg-white'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-[#4D0E13]">{addOn.name}</p>
                      <p className="mt-0.5 text-[12px] text-[#4D0E13]/55">{addOn.description}</p>
                    </div>
                    <p className="shrink-0 text-[15px] font-medium text-[#4D0E13]">+{addOn.price.toFixed(2)}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="border-t border-[#D8C4AC]/55 bg-white/92 px-4 pb-4 pt-3.5 shadow-[0_-8px_24px_rgba(31,8,10,0.08)] sm:px-5 sm:pb-5">
          <div className="mb-3 flex items-center justify-between rounded-[1.15rem] border border-[#D8C4AC]/60 bg-[#f8f4ee] px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4D0E13]/45">Updated price</p>
            </div>
            <p className="font-serif text-[1.4rem] font-bold leading-none text-[#4D0E13]">PHP {unitPrice.toFixed(2)}</p>
          </div>

          <button
            onClick={() => {
              onSave({
                ...draft,
                addOnIds: [...new Set(draft.addOnIds)].sort((a, b) => a.localeCompare(b)),
              });
            }}
            className="flex h-12 w-full items-center justify-center rounded-full bg-[#4D0E13] px-6 text-sm font-semibold text-[#F5EFE6] shadow-[0_12px_30px_rgba(77,14,19,0.22)] transition-transform hover:-translate-y-0.5 hover:bg-[#3a0a0e]"
          >
            {confirmLabel} - PHP {unitPrice.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
