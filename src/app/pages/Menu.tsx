import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, Product } from '../store';
import { Search, ShoppingCart, SlidersHorizontal, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { DrinkCustomizationModal } from '../components/DrinkCustomizationModal';
import type { DrinkCustomization } from '../store';

const CATEGORY_ORDER = ['Pastry', 'Beverage', 'Rice Meal', 'Merchandise'] as const;

const normalizeCategory = (category: string) => {
  const normalized = category.trim().toLowerCase();

  if (normalized === 'coffee' || normalized === 'non-coffee' || normalized === 'non - coffee' || normalized === 'tea' || normalized === 'beverage') {
    return 'Beverage';
  }
  if (normalized === 'pastries' || normalized === 'pastry') {
    return 'Pastry';
  }
  if (normalized === 'rice meal' || normalized === 'rice meals') {
    return 'Rice Meal';
  }
  if (normalized === 'merch' || normalized === 'merchandise') {
    return 'Merchandise';
  }

  return category;
};

export function Menu() {
  const [activeCategory, setActiveCategory] = useState('All Items');
  const [search, setSearch] = useState('');
  const [customizingProduct, setCustomizingProduct] = useState<(Product & { displayName: string }) | null>(null);
  const { addToCart, products } = useAppStore();

  const categorizedProducts = products.map((item) => ({
    ...item,
    displayName:
      item.name?.trim() ||
      String((item as Product & { title?: string; product_name?: string }).title ?? '').trim() ||
      String((item as Product & { title?: string; product_name?: string }).product_name ?? '').trim() ||
      'Untitled item',
    displayCategory: normalizeCategory(item.category),
  }));

  const categorySet = new Set(categorizedProducts.map((item) => item.displayCategory));
  const orderedCategories = CATEGORY_ORDER.filter((category) => categorySet.has(category));
  const otherCategories = [...categorySet]
    .filter((category) => !CATEGORY_ORDER.includes(category as typeof CATEGORY_ORDER[number]))
    .sort((a, b) => a.localeCompare(b));
  const categories = ['All Items', ...orderedCategories, ...otherCategories];

  const handleAdd = (item: Product & { displayName: string }) => {
    addToCart(item);
    toast.success(`${item.displayName} added to cart!`, {
      style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' },
    });
  };

  const handleCustomAdd = (item: Product & { displayName: string }, customization: DrinkCustomization) => {
    addToCart(item, customization);
    toast.success(`${item.displayName} customized and added to order!`, {
      style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' },
    });
  };

  const filteredItems = categorizedProducts.filter((item) => {
    const matchesCategory = activeCategory === 'All Items' || item.displayCategory === activeCategory;
    const matchesSearch = item.displayName.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const gridItems = filteredItems;

  const renderProductLayer = (item: typeof categorizedProducts[number]) => {
    const initials = item.displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

    if (item.image) {
      return (
        <ImageWithFallback
          src={item.image}
          alt={item.displayName}
          className="w-full h-full object-cover rounded-full mix-blend-multiply"
        />
      );
    }

    return (
      <div className="w-full h-full rounded-full bg-gradient-to-br from-[#EADDD1] via-[#F5EFE6] to-[#D8C4AC] flex items-center justify-center text-[#4D0E13] font-serif text-2xl font-bold shadow-inner">
        {initials || '•'}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-6 max-w-7xl pt-4 pb-20">
      {/* Header */}
      <div className="mb-10 flex flex-col gap-2">
        <h1 className="text-4xl md:text-5xl font-serif text-[#4D0E13] tracking-tight">Our Menu</h1>
        <p className="text-[#4D0E13]/60 text-sm font-medium">Handcrafted with love, made for you.</p>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10 border-b border-[#D8C4AC]/30 pb-6">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-[#4D0E13] text-[#F5EFE6] shadow-md'
                  : 'bg-transparent text-[#4D0E13]/60 hover:text-[#4D0E13] hover:bg-[#D8C4AC]/20 border border-[#D8C4AC]/40'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full lg:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4D0E13]/40" size={16} />
            <input
              type="text"
              placeholder="Search menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/60 backdrop-blur-sm border border-[#D8C4AC]/50 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8A49F]/50 transition-all text-[#4D0E13] placeholder-[#4D0E13]/40 shadow-sm"
            />
          </div>
          <button className="p-2.5 bg-white/60 border border-[#D8C4AC]/50 rounded-full text-[#4D0E13]/60 hover:text-[#4D0E13] shadow-sm transition-colors">
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* Menu Grid */}
      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16">
        <AnimatePresence mode="popLayout">
          {gridItems.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -16 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="relative flex flex-col items-center pt-10 transition-all duration-500 hover:-translate-y-1 sm:pt-11"
            >
              {/* Product Image - Minimal White Border */}
              <div className="absolute left-1/2 -top-8 z-20 h-44 w-44 -translate-x-1/2 rounded-full overflow-hidden ring-1 ring-white/50 shadow-[0_12px_26px_rgba(77,14,19,0.14)] sm:h-52 sm:w-52">
                <div className="h-full w-full bg-gradient-to-br from-[#EADDD1]/30 to-[#F5EFE6]">
                  {renderProductLayer(item)}
                </div>
              </div>

              {/* Card Body with 3 fixed zones: heading, content, footer */}
              <div className="group relative flex w-full min-h-[336px] flex-col rounded-[1.6rem] border border-white/70 bg-white/60 px-4 pb-4 pt-[7.4rem] shadow-[0_14px_30px_rgba(77,14,19,0.08)] backdrop-blur-xl transition-all duration-500 hover:shadow-[0_18px_36px_rgba(77,14,19,0.12)] sm:min-h-[352px] sm:px-5 sm:pb-4.5 sm:pt-[8.2rem]">
                {/* Zone 1: Title + Meta */}
                <div className="mb-2.5 min-h-[62px] text-center">
                  <h3 className="font-serif text-[1.16rem] font-semibold leading-tight text-[#4D0E13] sm:text-[1.22rem]">
                    {item.displayName}
                  </h3>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4D0E13]/45">
                    {item.displayCategory}
                  </p>
                </div>

                {/* Zone 2: Description */}
                <div className="min-h-[52px] flex-1">
                  <p className="line-clamp-2 text-[12.5px] leading-relaxed text-[#4D0E13]/62 sm:text-[0.83rem]">
                    {item.description}
                  </p>
                </div>

                {/* Zone 3: Footer */}
                <div className="mt-4 border-t border-[#D8C4AC]/45 pt-3.5">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <span className="font-serif text-[1.24rem] font-bold whitespace-nowrap text-[#4D0E13] sm:text-[1.34rem]">
                      ₱ {item.price}
                    </span>
                    <span className="rounded-full border border-[#D8C4AC]/55 bg-[#F5EFE6]/70 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#4D0E13]/55">
                      Freshly made
                    </span>
                  </div>

                  <button
                    onClick={() => handleAdd(item)}
                    className="flex h-10.5 w-full items-center justify-center gap-2 rounded-full bg-[#4D0E13] text-[13px] font-semibold text-[#F5EFE6] shadow-[0_10px_22px_rgba(77,14,19,0.2)] transition-colors hover:bg-[#3a0a0e]"
                  >
                    <ShoppingCart size={15} strokeWidth={2.4} />
                    <span className="tracking-wide">Add to Order</span>
                  </button>

                  <div className="mt-1.5 flex h-6 items-center justify-center">
                    {item.displayCategory === 'Beverage' ? (
                      <button
                        onClick={() => setCustomizingProduct(item)}
                        className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4D0E13]/70 transition-colors hover:text-[#4D0E13]"
                      >
                        <Sparkles size={12} />
                        <span>Customize</span>
                      </button>
                    ) : (
                      <span className="select-none text-[11px] opacity-0">Customize</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredItems.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-[#4D0E13]/40">
            <Search size={48} className="mb-4 opacity-50" strokeWidth={1} />
            <p className="text-xl font-serif italic">No items found in this category</p>
          </div>
        )}
      </div>

      <DrinkCustomizationModal
        open={Boolean(customizingProduct)}
        product={customizingProduct}
        onClose={() => setCustomizingProduct(null)}
        onSave={(customization) => {
          if (!customizingProduct) return;
          handleCustomAdd(customizingProduct, customization);
          setCustomizingProduct(null);
        }}
        confirmLabel="Add to cart"
      />
    </div>
  );
}