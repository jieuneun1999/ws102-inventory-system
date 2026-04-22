import { motion, useScroll, useTransform } from 'framer-motion';
import { useAppStore } from '../store';
import { ArrowRight, ShoppingBag, Leaf, Coffee } from 'lucide-react';
import { Link } from 'react-router';
import { useRef } from 'react';

export function Home() {
  const { addToCart, products } = useAppStore();
  const heroRef = useRef(null);
  const bestSellers = [products[1], products[4], products[7]].filter(Boolean);
  const baristaChoice = products[0] ?? products[1];
  
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start']
  });
  
  const yImage1 = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const yImage2 = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, filter: 'blur(5px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] } }
  };

  return (
    <div className="overflow-hidden">
      {/* Hero Section - Editorial Split Layout */}
      <section ref={heroRef} className="relative min-h-[95vh] flex items-center pt-20 pb-12 px-6 lg:px-12 max-w-[1600px] mx-auto">
        <div className="absolute inset-0 bg-gradient-to-b from-[#EEE4DA]/0 via-[#EEE4DA] to-[#EEE4DA] pointer-events-none z-10" />
        
        <div className="w-full grid lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-20">
          
          <motion.div 
            className="lg:col-span-5 space-y-10 lg:pl-12 z-30"
            initial="hidden"
            animate="show"
            variants={containerVariants}
          >
            <div className="space-y-4">
              <motion.div variants={itemVariants} className="flex items-center gap-3">
                <div className="w-8 h-[1px] bg-[#4D0E13]" />
                <span className="uppercase tracking-[0.3em] text-[#4D0E13]/70 text-xs font-bold">Artisanal Coffee</span>
              </motion.div>
              <motion.h1 variants={itemVariants} className="text-6xl md:text-[5.5rem] lg:text-8xl font-serif text-[#4D0E13] leading-[1] tracking-tight">
                Crafted.<br />
                <span className="italic font-light text-[#C8A49F]">Pouring</span><br />
                Perfection.
              </motion.h1>
            </div>
            
            <motion.p variants={itemVariants} className="text-lg md:text-xl text-[#4D0E13]/70 max-w-md font-serif italic leading-relaxed">
              Experience the soft luxury of artisanal coffee, crafted with precision and passion in every single cup.
            </motion.p>
            
            <motion.div variants={itemVariants} className="pt-4 flex items-center gap-8">
              <Link 
                to="/menu" 
                className="group relative inline-flex items-center justify-center px-8 py-4 overflow-hidden rounded-full border border-[#4D0E13] text-[#4D0E13] font-medium tracking-widest uppercase text-xs"
              >
                <span className="absolute w-0 h-0 transition-all duration-500 ease-out bg-[#4D0E13] rounded-full group-hover:w-64 group-hover:h-56"></span>
                <span className="relative flex items-center gap-3 group-hover:text-[#EEE4DA] transition-colors duration-300">
                  Explore Menu <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </motion.div>
          </motion.div>

          <div className="lg:col-span-7 relative h-[600px] md:h-[800px] w-full mt-12 lg:mt-0">
            {/* Main large image */}
            <motion.div 
              style={{ y: yImage1 }}
              className="absolute top-0 right-0 w-[85%] h-[80%] rounded-[2rem] overflow-hidden shadow-2xl shadow-[#4D0E13]/10"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              <div className="absolute inset-0 bg-[#4D0E13]/5 z-10" />
              <img 
                src="https://images.unsplash.com/photo-1758915753332-cab59126742c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwbHV4dXJ5JTIwY29mZmVlJTIwY3VwJTIwYWVzdGhldGljfGVufDF8fHx8MTc3NjY4OTQxMnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
                alt="Aesthetic Coffee" 
                className="w-full h-full object-cover object-center"
              />
            </motion.div>

            {/* Overlapping smaller image */}
            <motion.div 
              style={{ y: yImage2 }}
              className="absolute bottom-0 left-0 w-[45%] h-[55%] rounded-[1.5rem] overflow-hidden shadow-[0_20px_50px_-12px_rgba(77,14,19,0.2)] border-8 border-[#EEE4DA] z-20"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
            >
              <img 
                src="https://images.unsplash.com/photo-1749104028308-2bb6137db64d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBwb3VyaW5nJTIwbWluaW1hbCUyMGFlc3RoZXRpY3xlbnwxfHx8fDE3NzY2ODk0MTZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral" 
                alt="Pouring Coffee" 
                className="w-full h-full object-cover scale-110"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Best Sellers - Minimal Grid */}
      <section className="py-24 px-6 max-w-7xl mx-auto relative z-20 bg-[#EEE4DA]">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6 border-b border-[#D8C4AC]/40 pb-8">
          <div>
            <h2 className="text-4xl md:text-5xl font-serif text-[#4D0E13] tracking-tight">Curated Favorites.</h2>
            <p className="text-[#4D0E13]/50 font-serif italic mt-3 text-lg">The most loved selections by our patrons.</p>
          </div>
          <Link to="/menu" className="group flex items-center gap-3 text-xs uppercase tracking-[0.2em] font-semibold text-[#4D0E13] hover:text-[#C8A49F] transition-colors pb-2">
            View Full Menu
            <div className="w-8 h-[1px] bg-[#4D0E13] group-hover:bg-[#C8A49F] transition-colors group-hover:w-12" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {bestSellers.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: index * 0.15 }}
              className="group cursor-pointer flex flex-col"
            >
              <div className="relative overflow-hidden rounded-t-[2rem] rounded-b-xl aspect-[4/5] mb-6 bg-[#D8C4AC]/20">
                <img 
                  src={item.image} 
                  alt={item.name} 
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-1000 ease-[0.25,0.1,0.25,1]" 
                />
                
                {/* Floating Add to cart overlay */}
                <div className="absolute inset-0 bg-[#4D0E13]/0 group-hover:bg-[#4D0E13]/20 transition-colors duration-500 flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      addToCart(item);
                    }}
                    className="translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 bg-[#EEE4DA] text-[#4D0E13] px-6 py-3 rounded-full font-medium tracking-wider uppercase text-xs shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
                  >
                    <ShoppingBag size={14} /> Add
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-center text-center px-4">
                <span className="text-[#C8A49F] text-xs font-bold uppercase tracking-[0.2em] mb-3">{item.category}</span>
                <h3 className="text-2xl font-serif text-[#4D0E13] mb-2">{item.name}</h3>
                <p className="text-[#4D0E13]/60 text-sm font-sans mb-4 line-clamp-2 leading-relaxed">{item.description}</p>
                <span className="text-lg font-serif text-[#4D0E13] italic">₱{item.price.toFixed(2)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Barista's Choice - Full Bleed Split */}
      <section className="my-24 max-w-[1400px] mx-auto px-4 md:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="bg-[#4D0E13] rounded-[2.5rem] overflow-hidden flex flex-col md:flex-row shadow-2xl relative"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-64 -right-64 w-[500px] h-[500px] bg-[#C8A49F]/20 rounded-full blur-[100px]" />
            <div className="absolute -bottom-64 -left-64 w-[500px] h-[500px] bg-[#D8C4AC]/10 rounded-full blur-[100px]" />
          </div>
          
          <div className="flex-1 p-10 md:p-16 lg:p-24 flex flex-col justify-center relative z-10">
            <div className="flex items-center gap-3 mb-8 opacity-70">
              <Coffee size={16} className="text-[#D8C4AC]" />
              <span className="text-[#D8C4AC] font-bold tracking-[0.3em] uppercase text-xs">Signature</span>
            </div>
            
            <h2 className="text-5xl md:text-6xl font-serif mb-6 leading-tight text-[#d8c4ac]">
              {baristaChoice.name}
            </h2>
            
            <p className="text-[#EEE4DA]/70 text-lg font-sans mb-10 leading-relaxed max-w-md">
              {baristaChoice.description} A masterpiece recommended by our head roaster.
            </p>
            
            <button
              onClick={() => addToCart(baristaChoice)}
              className="self-start group relative inline-flex items-center justify-center px-8 py-4 overflow-hidden rounded-full bg-[#D8C4AC] text-[#4D0E13] font-medium tracking-widest uppercase text-xs transition-transform hover:scale-105"
            >
              <span className="relative flex items-center gap-3">
                Experience for ₱{baristaChoice.price.toFixed(2)}
              </span>
            </button>
          </div>

          <div className="flex-1 relative min-h-[400px] md:min-h-auto">
            <img 
              src={baristaChoice.image} 
              alt={baristaChoice.name} 
              className="absolute inset-0 w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#4D0E13] via-transparent to-transparent opacity-50 md:opacity-100 w-1/4" />
          </div>
        </motion.div>
      </section>

      {/* Values/Story - Minimal blocks */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif text-[#4D0E13] mb-4">Our Philosophy</h2>
          <div className="w-12 h-px bg-[#C8A49F] mx-auto" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            { title: "Ethical Sourcing", icon: Leaf, desc: "We partner directly with sustainable farms, ensuring fair wages and environmentally conscious growing practices." },
            { title: "Artisanal Roasting", icon: Coffee, desc: "Every batch is micro-roasted to perfection, bringing out the unique terroir and distinct flavor notes of each origin." },
            { title: "Community", icon: ShoppingBag, desc: "More than a cafe, we are a sanctuary for connection, reflection, and the simple joy of a perfect brew." }
          ].map((val, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.2 }}
              className="text-center space-y-4 px-4"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-[#D8C4AC]/20 flex items-center justify-center text-[#4D0E13] mb-6">
                <val.icon strokeWidth={1.5} size={28} />
              </div>
              <h3 className="text-2xl font-serif text-[#4D0E13]">{val.title}</h3>
              <p className="text-[#4D0E13]/60 text-sm leading-relaxed">{val.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
