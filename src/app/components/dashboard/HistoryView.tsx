import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock3, Box, ShoppingBag, Sparkles } from 'lucide-react';
import { useAppStore, type HistoryDomain } from '../../store';

type HistoryTab = 'all' | HistoryDomain;

export function HistoryView() {
  const { historyEvents } = useAppStore();
  const [activeTab, setActiveTab] = useState<HistoryTab>('all');

  const filtered = useMemo(() => {
    if (activeTab === 'all') return historyEvents;
    return historyEvents.filter((e) => e.domain === activeTab);
  }, [historyEvents, activeTab]);

  const tabs: { id: HistoryTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'orders', label: 'Orders' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'products', label: 'Products' },
  ];

  return (
    <div className="w-full flex flex-col h-full pt-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-serif text-[#4D0E13] tracking-tight">System History</h2>
          <p className="text-[#4D0E13]/60 font-medium text-sm">Track everything that happened across orders, products, and inventory.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab.id
                ? 'bg-[#4D0E13] text-[#EEE4DA]'
                : 'bg-white/50 text-[#4D0E13]/65 hover:text-[#4D0E13] border border-[#D8C4AC]/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3 hide-scrollbar">
        {filtered.length === 0 ? (
          <div className="h-52 rounded-2xl border border-dashed border-[#D8C4AC]/45 bg-white/35 flex flex-col items-center justify-center text-center">
            <Sparkles size={20} className="text-[#4D0E13]/30 mb-2" />
            <p className="text-[#4D0E13]/45 text-sm font-medium">No events found for this filter.</p>
          </div>
        ) : (
          filtered.map((event, idx) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.02, 0.2) }}
              className="bg-white/60 backdrop-blur-xl border border-white/70 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  {event.domain === 'orders' && <ShoppingBag size={14} className="text-[#4D0E13]/60" />}
                  {event.domain === 'inventory' && <Box size={14} className="text-[#4D0E13]/60" />}
                  {event.domain === 'products' && <Sparkles size={14} className="text-[#4D0E13]/60" />}
                  <h4 className="font-semibold text-[#4D0E13] text-sm">{event.title}</h4>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4D0E13]/45">
                  <Clock3 size={11} />
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-[#4D0E13]/60">{event.detail}</p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
