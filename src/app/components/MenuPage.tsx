import { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import { Coffee, Croissant, Utensils, Plus, Star, Heart } from 'lucide-react';
import { toast } from 'sonner';

type Category = 'all' | string;

const CATEGORY_ORDER = ['Pastry', 'Beverage', 'Rice Meal'] as const;

const getCategoryIcon = (category: string) => {
  if (category === 'Pastry') return Croissant;
  if (category === 'Rice Meal') return Utensils;
  return Coffee;
};

export function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const { products, addToCart, toggleFavorite } = useApp();

  const getProductTitle = (product: any) => {
    const fromName = String(product?.name ?? '').trim();
    const fromTitle = String(product?.title ?? '').trim();
    const fromProductName = String(product?.product_name ?? '').trim();
    return fromName || fromTitle || fromProductName || 'Untitled item';
  };

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter(p => p.category === selectedCategory);

  const categorySet = new Set(products.map((product) => product.category));
  const orderedKnownCategories = CATEGORY_ORDER.filter((category) => categorySet.has(category));
  const otherCategories = [...categorySet]
    .filter((category) => !CATEGORY_ORDER.includes(category as typeof CATEGORY_ORDER[number]))
    .sort((a, b) => a.localeCompare(b));
  const categoryList = [...orderedKnownCategories, ...otherCategories];

  const categories = [
    { id: 'all', label: 'All Items', icon: Coffee },
    ...categoryList.map((category) => ({
      id: category,
      label: category,
      icon: getCategoryIcon(category),
    })),
  ];

  const handleAddToCart = (product: any) => {
    addToCart(product);
    toast.success(`${getProductTitle(product)} added to cart!`);
  };

  return (
    <div className="min-h-screen pt-28 pb-16 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto"
      >
        <h1 className="mb-4 text-center" style={{ fontSize: '3rem', fontWeight: 600, color: 'var(--burgundy)' }}>
          Our Menu
        </h1>
        <p className="mb-12 text-center" style={{ fontSize: '1.25rem', color: 'var(--coffee-brown)', opacity: 0.8 }}>
          Discover our carefully curated selection of beverages and treats
        </p>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = selectedCategory === category.id;
            return (
              <motion.button
                key={category.id}
                onClick={() => setSelectedCategory(category.id as Category)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-2 px-6 py-3 rounded-full backdrop-blur-md border transition-all duration-300 ${
                  isActive
                    ? 'bg-burgundy text-white border-burgundy shadow-lg'
                    : 'bg-white/40 border-white/30 hover:bg-white/50 hover:border-white/40'
                }`}
                style={!isActive ? { color: 'var(--coffee-brown)' } : {}}
              >
                <Icon size={20} />
                <span style={{ fontWeight: isActive ? 600 : 500 }}>{category.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 overflow-hidden shadow-[0_8px_32px_0_rgba(107,27,27,0.1)] hover:shadow-[0_12px_48px_0_rgba(107,27,27,0.15)] transition-all duration-300"
              style={{
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <div className="relative p-4">
                <div className="relative h-48 rounded-2xl overflow-hidden bg-white/40 mb-4">
                  <img
                    src={product.image}
                    alt={getProductTitle(product)}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                  {product.inStock < 10 && (
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-burgundy text-white text-xs">
                      Low Stock
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(product.id);
                      toast.success(product.isFavorite ? 'Removed from favorites' : 'Added to favorites');
                    }}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all"
                  >
                    <Heart
                      size={18}
                      fill={product.isFavorite ? 'var(--burgundy)' : 'none'}
                      style={{ color: product.isFavorite ? 'var(--burgundy)' : 'var(--coffee-brown)' }}
                    />
                  </button>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                      {getProductTitle(product)}
                    </h3>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs"
                      style={{
                        backgroundColor: 'var(--sand)',
                        color: 'var(--burgundy)',
                      }}
                    >
                      {product.category}
                    </span>
                  </div>

                  {product.rating && (
                    <div className="flex items-center gap-1 mb-2">
                      <Star size={14} fill="var(--burgundy)" style={{ color: 'var(--burgundy)' }} />
                      <span style={{ fontSize: '0.875rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                        {product.rating.toFixed(1)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--coffee-brown)', opacity: 0.6 }}>
                        (25 reviews)
                      </span>
                    </div>
                  )}

                  <p className="mb-3 line-clamp-2" style={{ color: 'var(--coffee-brown)', opacity: 0.7, fontSize: '0.85rem', lineHeight: 1.5 }}>
                    {product.description}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--burgundy)' }}>
                    ${product.price.toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.inStock === 0}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all ${
                      product.inStock === 0
                        ? 'bg-gray-300 cursor-not-allowed text-gray-600'
                        : 'bg-burgundy text-white hover:bg-burgundy-dark hover:scale-105'
                    }`}
                  >
                    <Plus size={16} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                      {product.inStock === 0 ? 'Out' : 'Order'}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-20">
            <p style={{ fontSize: '1.25rem', color: 'var(--coffee-brown)', opacity: 0.6 }}>
              No products found in this category
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
