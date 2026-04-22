import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store';

export function ProductsView() {
  const products = useAppStore((state) => state.products);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  const getProductTitle = (item: any) => {
    const fromName = String(item?.name ?? '').trim();
    const fromTitle = String(item?.title ?? '').trim();
    const fromProductName = String(item?.product_name ?? '').trim();
    return fromName || fromTitle || fromProductName || 'Untitled item';
  };

  return (
    <div className="w-full flex flex-col h-full pt-4">
      <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl md:text-4xl font-serif text-[#4D0E13] tracking-tight">Products</h2>
          <p className="text-[#4D0E13]/60 font-medium text-sm">Product catalog with connected ingredients per item.</p>
        </div>
        <div className="flex gap-1.5 bg-white/50 border border-[#D8C4AC]/30 rounded-full p-1 backdrop-blur-md">
          {(['cards', 'list'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all capitalize ${
                viewMode === mode
                  ? 'bg-[#4D0E13] text-[#EEE4DA] shadow-sm'
                  : 'text-[#4D0E13]/60 hover:text-[#4D0E13]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-8">
          {products.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.02, 0.2) }}
              className="bg-white/65 backdrop-blur-xl border border-white/70 rounded-[1.5rem] p-5 shadow-[0_4px_24px_rgba(77,14,19,0.03)]"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-serif text-xl text-[#4D0E13] leading-tight">{getProductTitle(item)}</h3>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#D8C4AC]/25 text-[#4D0E13]/70 whitespace-nowrap">
                  {item.category}
                </span>
              </div>

              <p className="text-sm text-[#4D0E13]/60 mb-3 min-h-[40px]">{item.description || 'No description.'}</p>

              <div className="mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#4D0E13]/45 mb-1.5">Connected Ingredients</p>
                {item.ingredients && item.ingredients.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {item.ingredients.map((ingredient) => (
                      <span
                        key={`${item.id}-${ingredient}`}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#F5EFE6] border border-[#D8C4AC]/45 text-[#4D0E13]/75"
                      >
                        {ingredient}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#4D0E13]/45">No linked ingredients listed.</p>
                )}
              </div>

              <div className="pt-3 border-t border-[#D8C4AC]/30 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#4D0E13]/45">Product ID</span>
                <span className="text-xs font-semibold text-[#4D0E13]/60">{item.id}</span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="overflow-auto rounded-2xl border border-[#D8C4AC]/35 bg-white/60 backdrop-blur-xl">
          <table className="w-full text-sm">
            <thead className="bg-[#F5EFE6]/70 text-[#4D0E13]/70 uppercase tracking-wider text-xs">
              <tr>
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-left px-4 py-3">Ingredients</th>
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr key={item.id} className="border-t border-[#D8C4AC]/25 text-[#4D0E13]">
                  <td className="px-4 py-3 font-semibold text-xs">{item.id}</td>
                  <td className="px-4 py-3 font-semibold">{getProductTitle(item)}</td>
                  <td className="px-4 py-3">{item.category}</td>
                  <td className="px-4 py-3 text-[#4D0E13]/70">{item.description || 'No description.'}</td>
                  <td className="px-4 py-3 text-[#4D0E13]/70">
                    {item.ingredients && item.ingredients.length > 0 ? item.ingredients.join(', ') : 'No linked ingredients'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
