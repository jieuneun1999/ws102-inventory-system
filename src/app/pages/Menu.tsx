import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, type Product } from '../store';
import { Minus, Plus, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { DrinkCustomizationModal } from '../components/DrinkCustomizationModal';
import type { DrinkCustomization } from '../store';
import { ExpandableDescription } from '../components/ui/ExpandableDescription';

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
  const { addToCart, cart, updateQuantity, products, getProductAvailability } = useAppStore();

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
    if (!addToCart(item)) {
      toast.error(`${item.displayName} is out of stock.`);
      return;
    }
    toast.success(`${item.displayName} added to cart!`, {
      style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' },
    });
  };

  const handleCustomAdd = (item: Product & { displayName: string }, customization: DrinkCustomization) => {
    if (!addToCart(item, customization)) {
      toast.error(`${item.displayName} is out of stock.`);
      return;
    }
    toast.success(`${item.displayName} customized and added to order!`, {
      style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' },
    });
  };

  const getItemQuantity = (productId: string) =>
    cart
      .filter((entry) => entry.id === productId)
      .reduce((sum, entry) => sum + entry.quantity, 0);

  const handleDecrease = (item: Product & { displayName: string }) => {
    const target = cart.find((entry) => entry.id === item.id);
    if (!target) return;
    updateQuantity(target.cartItemId, target.quantity - 1);
  };

  const filteredItems = categorizedProducts.filter((item) => {
    const matchesCategory = activeCategory === 'All Items' || item.displayCategory === activeCategory;
    const matchesSearch = item.displayName.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
          className="w-full h-full object-cover rounded-full"
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
      <div className="mb-10 flex flex-col gap-2">
        <h1 className="text-4xl md:text-5xl font-serif text-[#4D0E13] tracking-tight">Our Menu</h1>
        <p className="text-[#4D0E13]/60 text-sm font-medium">Handcrafted with love, made for you.</p>
      </div>

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

      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-20 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-10 xl:gap-y-24">
        <AnimatePresence mode="popLayout">
          {filteredItems.length === 0 ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-[#4D0E13]/40">
              <Search size={48} className="mb-4 opacity-50" strokeWidth={1} />
              <p className="text-xl font-serif italic">No items found in this category</p>
            </div>
          ) : (
            filteredItems.map((item, i) => {
              const availability = getProductAvailability(item.id);
              const isOutOfStock = availability.isOutOfStock;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -16 }}
                  transition={{ duration: 0.35, delay: i * 0.04 }}
                  className={`relative flex flex-col items-center pt-8 transition-all duration-500 hover:-translate-y-1 sm:pt-9 ${
                    isOutOfStock ? 'opacity-70 grayscale-[0.15]' : ''
                  }`}
                >
                  <div className="absolute left-1/2 -top-7 z-20 h-32 w-32 -translate-x-1/2 rounded-full overflow-hidden ring-1 ring-white/65 shadow-[0_10px_20px_rgba(77,14,19,0.15)] sm:h-36 sm:w-36">
                    <div className="h-full w-full bg-gradient-to-br from-[#EADDD1]/35 via-[#F5EFE6]/55 to-[#F8F2EA]/45">
                      {renderProductLayer(item)}
                    </div>
                  </div>

                  <div className="group relative flex w-full min-h-[286px] flex-col rounded-[1.45rem] border border-white/68 bg-[linear-gradient(155deg,rgba(245,239,230,0.58),rgba(255,255,255,0.3))] px-4 pb-4 pt-[4.9rem] shadow-[0_16px_30px_rgba(77,14,19,0.1)] backdrop-blur-xl transition-all duration-500 hover:shadow-[0_20px_36px_rgba(77,14,19,0.16)] sm:min-h-[300px] sm:px-5 sm:pt-[5.3rem]">
                    {isOutOfStock && (
                      <div className="absolute right-4 top-4 rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-md">
                        Out of stock
                      </div>
                    )}

                    <div className="mb-2 min-h-[56px] text-center">
                      <h3 className="font-serif text-[1.04rem] font-semibold leading-tight text-[#4D0E13] sm:text-[1.1rem]">
                        {item.displayName}
                      </h3>
                      <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#4D0E13]/52">
                        {item.displayCategory}
                      </p>
                    </div>

                    <div className="min-h-[48px] flex-1">
                      <ExpandableDescription
                        id={item.id}
                        text={item.description}
                        fallback="No description."
                        clampLines={3}
                        wrapperClassName="min-h-[4.75rem]"
                        textClassName="text-[12px] text-[#4D0E13]/68 sm:text-[0.8rem]"
                        buttonClassName="text-[#4D0E13]/58 hover:text-[#4D0E13]"
                        fadeClassName="bg-gradient-to-b from-transparent to-[#F5EFE6]/95"
                      />
                    </div>

                    <div className="mt-3.5 border-t border-[#D8C4AC]/45 pt-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="font-serif text-[1.45rem] font-bold whitespace-nowrap text-[#4D0E13] sm:text-[1.6rem]">
                          ₱ {item.price}
                        </span>
                        <div className="flex items-center gap-2 rounded-full border border-[#D8C4AC]/60 bg-white/45 px-2 py-1.5 backdrop-blur-md">
                          <button
                            onClick={() => handleDecrease(item)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D8C4AC]/65 bg-white/75 text-[#4D0E13] transition-colors hover:bg-white"
                            aria-label={`Decrease ${item.displayName}`}
                          >
                            <Minus size={17} />
                          </button>
                          <span className="min-w-[2ch] text-center text-lg font-bold text-[#4D0E13]">
                            {getItemQuantity(item.id)}
                          </span>
                          <button
                            onClick={() => handleAdd(item)}
                            disabled={isOutOfStock}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#4D0E13]/70 bg-[#4D0E13] text-white transition-colors hover:bg-[#3a0a0e] disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Increase ${item.displayName}`}
                          >
                            <Plus size={17} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-1.5 flex h-6 items-center justify-center">
                        {item.displayCategory === 'Beverage' ? (
                          <button
                            onClick={() => setCustomizingProduct(item)}
                            disabled={isOutOfStock}
                            className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4D0E13]/75 transition-colors hover:text-[#4D0E13] disabled:cursor-not-allowed disabled:opacity-40"
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
              );
            })
          )}
        </AnimatePresence>
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
        confirmLabel="Add to order"
      />
    </div>
  );
}