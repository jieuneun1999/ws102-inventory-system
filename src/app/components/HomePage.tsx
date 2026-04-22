import { useState } from 'react';
import { Search, Coffee, Award, Users, Star, Heart, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { products, addToCart, toggleFavorite } = useApp();

  const bestSellers = products.slice(0, 3);
  const baristasChoice = products[3];

  return (
    <div className="min-h-screen pt-28 pb-16 px-4">
      {/* Hero Section with Search */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="max-w-5xl mx-auto text-center mb-28 relative"
      >
        <motion.h1 
          className="mb-4 relative z-10 font-serif tracking-tight" 
          style={{ fontSize: 'clamp(4rem, 8vw, 7rem)', fontWeight: 600, color: 'var(--burgundy)', lineHeight: 1.1 }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Artisan Coffee <br/>
          <span style={{ color: 'var(--dusty-pink)' }}>&</span> Pastries
        </motion.h1>
        
        <motion.p 
          className="mb-12 max-w-2xl mx-auto" 
          style={{ fontSize: '1.25rem', color: 'var(--coffee-brown)', opacity: 0.8 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          Experience the finest sustainably sourced coffee, meticulously crafted by our expert baristas for your daily ritual.
        </motion.p>

        {/* Search Bar */}
        <motion.div 
          className="relative max-w-xl mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className="absolute left-6 top-1/2 -translate-y-1/2">
            <Search
              size={20}
              style={{ color: 'var(--burgundy)', opacity: 0.7 }}
            />
          </div>
          <input
            type="text"
            placeholder="Search for coffee, pastries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-4 rounded-full backdrop-blur-md bg-white/40 border border-white/30 outline-none focus:border-burgundy/40 focus:bg-white/50 transition-all shadow-lg focus:shadow-xl"
            style={{
              color: 'var(--coffee-brown)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          />
        </motion.div>
      </motion.div>

      {/* Marquee Section */}
      <div className="w-full overflow-hidden mb-28 border-y py-4 border-burgundy/10 bg-white/10 backdrop-blur-sm -mx-4 px-4 w-[calc(100%+2rem)] sm:w-auto sm:mx-0 sm:px-0">
        <motion.div
          animate={{ x: [0, -1000] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="flex items-center whitespace-nowrap gap-12 text-burgundy/60"
          style={{ fontFamily: 'Playfair Display', fontSize: '1.2rem', fontStyle: 'italic' }}
        >
          {Array.from({ length: 15 }).map((_, i) => (
            <span key={i} className="flex items-center gap-12">
              <span>Freshly Roasted</span>
              <span className="w-2 h-2 rounded-full bg-burgundy/30" />
              <span>Artisan Pastries</span>
              <span className="w-2 h-2 rounded-full bg-burgundy/30" />
              <span>Single Origin</span>
              <span className="w-2 h-2 rounded-full bg-burgundy/30" />
            </span>
          ))}
        </motion.div>
      </div>

      {/* Best Sellers */}
      <section className="max-w-7xl mx-auto mb-20 relative z-10">
        <div className="flex items-center gap-4 mb-10 justify-center">
          <Award size={36} style={{ color: 'var(--burgundy)' }} />
          <h2 className="font-serif italic" style={{ fontSize: '3rem', color: 'var(--burgundy)' }}>Best Sellers</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {bestSellers.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="relative rounded-3xl backdrop-blur-xl bg-white/40 border border-white/40 overflow-hidden shadow-[0_8px_32px_0_rgba(107,27,27,0.06)] hover:shadow-[0_16px_56px_0_rgba(107,27,27,0.12)] transition-all duration-500 group"
              style={{
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/40 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none -translate-x-full group-hover:translate-x-full ease-in-out z-20" style={{ transitionProperty: 'transform, opacity' }} />

              <div className="relative p-5 z-10">
                <div className="relative h-56 rounded-2xl overflow-hidden bg-white/40 mb-4">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-burgundy text-white flex items-center gap-1">
                    <Award size={14} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Best Seller</span>
                  </div>
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

                <div className="mb-4">
                  <h3 className="mb-2 font-serif" style={{ fontSize: '1.75rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                    {product.name}
                  </h3>

                  {product.rating && (
                    <div className="flex items-center gap-1 mb-2">
                      <Star size={16} fill="var(--burgundy)" style={{ color: 'var(--burgundy)' }} />
                      <span style={{ fontSize: '0.95rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                        {product.rating.toFixed(1)}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--coffee-brown)', opacity: 0.6 }}>
                        (25 reviews)
                      </span>
                    </div>
                  )}

                  <p className="mb-4" style={{ color: 'var(--coffee-brown)', opacity: 0.75, fontSize: '0.9rem', lineHeight: 1.5 }}>
                    {product.description}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--burgundy)' }}>
                    ${product.price.toFixed(2)}
                  </span>
                  <button
                    onClick={() => {
                      addToCart(product);
                      toast.success(`${product.name} added to cart!`);
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-burgundy text-white hover:bg-burgundy-dark hover:scale-105 transition-all"
                  >
                    <Plus size={18} />
                    <span style={{ fontWeight: 600 }}>Order</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Barista's Choice */}
      <section className="max-w-7xl mx-auto mb-28 relative z-10">
        <div className="flex items-center gap-4 mb-10 justify-center">
          <Coffee size={36} style={{ color: 'var(--burgundy)' }} />
          <h2 className="font-serif italic" style={{ fontSize: '3rem', color: 'var(--burgundy)' }}>Barista's Choice</h2>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative grid grid-cols-1 md:grid-cols-2 gap-8 rounded-[2rem] backdrop-blur-xl bg-white/40 border border-white/40 overflow-hidden shadow-[0_8px_32px_0_rgba(107,27,27,0.06)] hover:shadow-[0_16px_56px_0_rgba(107,27,27,0.12)] transition-all duration-500 group"
          style={{
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/40 to-white/0 opacity-0 group-hover:opacity-100 transition-all duration-1000 pointer-events-none -translate-x-full group-hover:translate-x-full ease-in-out z-20" />

          <div className="relative h-[30rem] md:h-auto overflow-hidden group/image">
            <img
              src={baristasChoice.image}
              alt={baristasChoice.name}
              className="w-full h-full object-cover group-hover/image:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(baristasChoice.id);
                toast.success(baristasChoice.isFavorite ? 'Removed from favorites' : 'Added to favorites');
              }}
              className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all"
            >
              <Heart
                size={22}
                fill={baristasChoice.isFavorite ? 'var(--burgundy)' : 'none'}
                style={{ color: baristasChoice.isFavorite ? 'var(--burgundy)' : 'var(--coffee-brown)' }}
              />
            </button>
          </div>
          <div className="p-8 flex flex-col justify-center">
            <div className="mb-6 px-5 py-2.5 rounded-full bg-burgundy/10 border border-burgundy/20 text-burgundy inline-flex items-center gap-2 w-fit">
              <Coffee size={18} />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Featured Today</span>
            </div>
            <h3 className="mb-4 font-serif" style={{ fontSize: '3.5rem', color: 'var(--burgundy)', fontWeight: 600, lineHeight: 1.1 }}>
              {baristasChoice.name}
            </h3>

            {baristasChoice.rating && (
              <div className="flex items-center gap-1 mb-4">
                <Star size={20} fill="var(--burgundy)" style={{ color: 'var(--burgundy)' }} />
                <span style={{ fontSize: '1.1rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                  {baristasChoice.rating.toFixed(1)}
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--coffee-brown)', opacity: 0.6 }}>
                  (25 reviews)
                </span>
              </div>
            )}

            <p className="mb-4" style={{ fontSize: '1.05rem', color: 'var(--coffee-brown)', opacity: 0.8, lineHeight: 1.6 }}>
              {baristasChoice.description}
            </p>
            <p className="mb-6" style={{ fontSize: '1rem', color: 'var(--coffee-brown)', opacity: 0.75, lineHeight: 1.6 }}>
              Our expert baristas have carefully crafted this exceptional blend to deliver the perfect balance of flavor and aroma. Made with premium beans sourced from the finest coffee regions.
            </p>
            <div className="flex items-center gap-4">
              <span style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--burgundy)' }}>
                ${baristasChoice.price.toFixed(2)}
              </span>
              <button
                onClick={() => {
                  addToCart(baristasChoice);
                  toast.success(`${baristasChoice.name} added to cart!`);
                }}
                className="flex items-center gap-2 px-8 py-3 rounded-full bg-burgundy text-white hover:bg-burgundy-dark hover:scale-105 transition-all"
              >
                <Plus size={20} />
                <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>Order Now</span>
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* About Us */}
      <section className="max-w-7xl mx-auto relative z-10">
        <div className="flex items-center gap-4 mb-10 justify-center">
          <Users size={36} style={{ color: 'var(--burgundy)' }} />
          <h2 className="font-serif italic" style={{ fontSize: '3rem', color: 'var(--burgundy)' }}>About Us</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-[2rem] backdrop-blur-xl bg-white/40 border border-white/40 p-10 shadow-[0_8px_32px_0_rgba(107,27,27,0.06)] hover:shadow-[0_16px_56px_0_rgba(107,27,27,0.12)] transition-all duration-500 overflow-hidden group"
            style={{
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" />
            <h3 className="relative z-10 mb-5 font-serif" style={{ fontSize: '2.25rem', color: 'var(--burgundy)', fontWeight: 600 }}>Our Story</h3>
            <p className="relative z-10 text-lg" style={{ color: 'var(--coffee-brown)', opacity: 0.85, lineHeight: 1.8 }}>
              Founded in 2020, our café began with a simple dream: to create a welcoming space where coffee lovers could gather and enjoy exceptional beverages. What started as a small neighborhood coffee shop has grown into a beloved community hub, known for our commitment to quality, sustainability, and warm hospitality.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-[2rem] backdrop-blur-xl bg-white/40 border border-white/40 p-10 shadow-[0_8px_32px_0_rgba(107,27,27,0.06)] hover:shadow-[0_16px_56px_0_rgba(107,27,27,0.12)] transition-all duration-500 overflow-hidden group"
            style={{
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-bl from-white/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" />
            <h3 className="relative z-10 mb-5 font-serif" style={{ fontSize: '2.25rem', color: 'var(--burgundy)', fontWeight: 600 }}>Meet the Owner</h3>
            <p className="relative z-10 text-lg" style={{ color: 'var(--coffee-brown)', opacity: 0.85, lineHeight: 1.8 }}>
              Sarah Martinez, our founder and owner, brings over 15 years of experience in the coffee industry. Her passion for sustainable sourcing and artisanal coffee preparation has shaped our café's philosophy. Sarah personally selects each coffee bean and works closely with our baristas to ensure every cup meets her exacting standards.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-[2rem] backdrop-blur-xl bg-white/40 border border-white/40 p-10 shadow-[0_8px_32px_0_rgba(107,27,27,0.06)] hover:shadow-[0_16px_56px_0_rgba(107,27,27,0.12)] transition-all duration-500 md:col-span-2 overflow-hidden group"
            style={{
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-white/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" />
            <h3 className="relative z-10 mb-5 font-serif" style={{ fontSize: '2.25rem', color: 'var(--burgundy)', fontWeight: 600 }}>Our Baristas</h3>
            <p className="relative z-10 text-lg" style={{ color: 'var(--coffee-brown)', opacity: 0.85, lineHeight: 1.8 }}>
              Our team of skilled baristas are the heart of our café. Each team member undergoes extensive training in coffee preparation, latte art, and customer service. They're not just making drinks – they're crafting experiences. From the perfect espresso extraction to creating beautiful latte art, our baristas are passionate about their craft and dedicated to making your visit memorable.
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto text-center mt-20"
      >
        <Link
          to="/menu"
          className="inline-flex items-center gap-3 px-12 py-4 rounded-full bg-burgundy text-white hover:bg-burgundy-dark hover:scale-105 transition-all text-lg shadow-lg hover:shadow-xl"
        >
          <Coffee size={22} />
          <span style={{ fontWeight: 600 }}>Explore Full Menu</span>
        </Link>
      </motion.div>
    </div>
  );
}
