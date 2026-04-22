import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, Product } from '../store';
import { Search, ShoppingCart, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

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

  const filteredItems = categorizedProducts.filter((item) => {
    const matchesCategory = activeCategory === 'All Items' || item.displayCategory === activeCategory;
    const matchesSearch = item.displayName.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredItem = categorizedProducts.find((item) => item.id === 'b1') ?? categorizedProducts[0];
  const gridItems = filteredItems.filter(item => item.id !== featuredItem?.id);
  const hasFeaturedImage = Boolean(featuredItem?.image);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-20 lg:gap-x-6 lg:gap-y-24 mt-2">
        <AnimatePresence mode="popLayout">
          {gridItems.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -16 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="relative pt-8 flex flex-col items-center transition-all duration-500 hover:-translate-y-2 sm:pt-10"
            >
              {/* Product Image - Minimal White Border */}
              <div className="absolute left-1/2 -top-4 z-20 h-40 w-40 -translate-x-1/2 rounded-full overflow-hidden ring-1 ring-white/40 sm:-top-5 sm:h-44 sm:w-44">
                <div className="h-full w-full bg-gradient-to-br from-[#EADDD1]/30 to-[#F5EFE6]">
                  {renderProductLayer(item)}
                </div>
              </div>

              {/* Card Body with Title Inside */}
              <div className="group relative w-full flex min-h-[300px] flex-col rounded-[1.8rem] border border-white/60 bg-white/55 px-4 pb-4 pt-28 shadow-[0_8px_30px_rgba(77,14,19,0.06)] backdrop-blur-xl transition-all duration-500 hover:shadow-[0_12px_40px_rgba(77,14,19,0.1)] sm:min-h-[320px] sm:px-4.5 sm:pb-4.5 sm:pt-[7rem]">
                {/* Product Title - Inside Card */}
                <div className="mb-3 text-center">
                  <h3 className="font-serif text-[1.15rem] font-semibold leading-tight text-[#4D0E13] sm:text-[1.2rem]">
                    {item.displayName}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-[#4D0E13]/50">
                    {item.displayCategory}
                  </p>
                </div>

                <div className="flex-1">
                  <p className="line-clamp-2 text-sm leading-relaxed text-[#4D0E13]/65 sm:text-[0.85rem]">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <span className="font-serif text-[1.25rem] font-bold text-[#4D0E13] whitespace-nowrap sm:text-[1.35rem]">
                    ₱ {item.price}
                  </span>

                  <button
                    onClick={() => handleAdd(item)}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 border border-white text-[#4D0E13] shadow-sm transition-colors hover:bg-[#4D0E13] hover:text-[#F5EFE6] sm:h-13 sm:w-13"
                  >
                    <ShoppingCart size={20} strokeWidth={2.5} className="sm:size-[22px]" />
                  </button>
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
    </div>
  );
}