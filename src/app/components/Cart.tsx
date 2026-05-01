import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { type OrderType, type PaymentMethod, useAppStore } from '../store';
import { X, Minus, Plus, ShoppingBag, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { DrinkCustomizationModal } from './DrinkCustomizationModal';
import { DRINK_ADD_ONS, type CartItem } from '../store';

export function Cart() {
  const {
    cart,
    cartOpen,
    setCartOpen,
    updateQuantity,
    removeFromCart,
    updateCartItemCustomization,
    cartTotal,
    addToCart,
    createOrder,
    getOrder,
    clearCart,
    products,
    getProductAvailability,
  } = useAppStore();
  const [customizingItem, setCustomizingItem] = useState<CartItem | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ewallet');
  const [checkoutSuccess, setCheckoutSuccess] = useState<{ orderNumber: string; orderType: OrderType } | null>(null);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const orderId = createOrder(orderType, paymentMethod);
    if (!orderId) {
      toast.error('Some items are out of stock or manually unavailable.');
      return;
    }
    const createdOrder = getOrder(orderId);
    clearCart();
    toast.success('Order placed successfully! Waiting for cashier approval.', {
      style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' },
    });
    setCartOpen(false);
    setCheckoutSuccess({
      orderNumber: createdOrder?.orderNumber ?? orderId,
      orderType,
    });
  };

  const subtotal = cartTotal();
  const total = subtotal;

  // Recommendations: Just taking the pastries for "You might also like"
  const recommendations = products.filter(item => item.category === 'Pastry');

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setCartOpen(false)}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ ease: 'easeOut', duration: 0.4 }}
            className="fixed right-0 md:right-4 top-0 md:top-4 h-full md:h-[calc(100vh-32px)] w-full max-w-[400px] bg-white/70 backdrop-blur-3xl border border-white/60 md:rounded-[2.5rem] shadow-[-10px_0_40px_rgba(77,14,19,0.05)] z-50 flex flex-col font-sans"
          >
            <div className="p-8 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[#4D0E13]">
                <ShoppingBag size={20} strokeWidth={2} />
                <h2 className="text-xl font-serif font-bold tracking-wide">
                  Your Cart
                </h2>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-2 -mr-2 text-[#4D0E13]/50 hover:text-[#4D0E13] transition-colors"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-8 hide-scrollbar flex flex-col gap-6">
              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-[#4D0E13]/40 space-y-4">
                  <ShoppingBag size={48} className="opacity-20" strokeWidth={1} />
                  <p className="text-base font-serif italic text-center">Your cart feels a bit light.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {cart.map((item) => (
                      <motion.div 
                        key={item.cartItemId} 
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center gap-4 bg-white/50 backdrop-blur-xl p-3 rounded-3xl shadow-sm border border-white/60"
                      >
                        <div className="w-14 h-14 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-[#EADDD1]/30 to-transparent flex items-center justify-center">
                          <ImageWithFallback src={item.image} alt={item.name} className="w-10 h-10 object-cover mix-blend-multiply" />
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center">
                          <h4 className="font-serif text-[#4D0E13] font-medium text-sm leading-tight mb-1">{item.name}</h4>
                          {item.customization && (
                            <p className="mb-1 text-[11px] text-[#4D0E13]/60">
                              {item.customization.size} | {item.customization.sugarLevel}% sugar
                              {item.customization.addOnIds.length > 0
                                ? ` | ${item.customization.addOnIds
                                    .map((id) => DRINK_ADD_ONS.find((entry) => entry.id === id)?.name)
                                    .filter(Boolean)
                                    .join(', ')}`
                                : ''}
                            </p>
                          )}
                          <p className="text-[#4D0E13]/60 font-bold text-xs font-serif">₱ {item.price}</p>
                          {item.category === 'Beverage' && (
                            <button
                              onClick={() => setCustomizingItem(item)}
                              className="mt-1 w-fit text-[11px] font-semibold text-[#4D0E13] underline-offset-2 hover:underline"
                            >
                              Customize
                            </button>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-white/80 rounded-full shadow-sm border border-white px-2 py-1 gap-3">
                            <button onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)} className="text-[#4D0E13]/50 hover:text-[#4D0E13]">
                              <Minus size={12} strokeWidth={3} />
                            </button>
                            <span className="text-xs font-bold text-[#4D0E13] w-2 text-center">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)} className="text-[#4D0E13]/50 hover:text-[#4D0E13]">
                              <Plus size={12} strokeWidth={3} />
                            </button>
                          </div>
                          <button onClick={() => removeFromCart(item.cartItemId)} className="text-[#D9534F]/60 hover:text-[#D9534F] p-1.5 transition-colors">
                            <Trash2 size={16} strokeWidth={2} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* You might also like section */}
              <div className="mt-4 border-t border-[#D8C4AC]/30 pt-6">
                <h3 className="text-xs uppercase font-bold tracking-widest text-[#4D0E13]/50 mb-4">You might also like</h3>
                <div className="space-y-3">
                  {recommendations.slice(0, 2).map((rec) => (
                    <div key={rec.id} className="flex items-center gap-4 group">
                      <div className="w-12 h-12 shrink-0 rounded-2xl overflow-hidden bg-[#EADDD1]/20 flex items-center justify-center p-2">
                        <ImageWithFallback src={rec.image} alt={rec.name} className="w-full h-full object-cover mix-blend-multiply rounded-xl group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-serif text-[#4D0E13] text-sm mb-0.5">{rec.name}</h4>
                        <p className="text-[#4D0E13]/60 font-bold text-xs font-serif">₱ {rec.price}</p>
                      </div>
                      <button 
                        onClick={() => {
                          if (!addToCart(rec)) {
                            toast.error(`${rec.name} is out of stock.`);
                          }
                        }}
                        disabled={getProductAvailability(rec.id).isOutOfStock}
                        className="w-7 h-7 rounded-full bg-[#4D0E13] text-[#F5EFE6] flex items-center justify-center shadow-md hover:bg-[#3a0a0e] hover:scale-105 transition-all shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8 pt-0 mt-auto">
              <div className="mb-5 rounded-2xl border border-[#D8C4AC]/50 bg-white/70 p-3 shadow-sm">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#4D0E13]/55">Order type</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOrderType('pickup')}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                      orderType === 'pickup'
                        ? 'bg-[#4D0E13] text-[#F5EFE6] shadow-md'
                        : 'bg-white text-[#4D0E13]/70 border border-[#D8C4AC]/60'
                    }`}
                  >
                    Pickup
                  </button>
                  <button
                    onClick={() => setOrderType('delivery')}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                      orderType === 'delivery'
                        ? 'bg-[#4D0E13] text-[#F5EFE6] shadow-md'
                        : 'bg-white text-[#4D0E13]/70 border border-[#D8C4AC]/60'
                    }`}
                  >
                    Delivery
                  </button>
                </div>

                <p className="mt-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-[#4D0E13]/55">Payment</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-white text-[#4D0E13]/70 border border-[#D8C4AC]/60'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    onClick={() => setPaymentMethod('ewallet')}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                      paymentMethod === 'ewallet'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-[#4D0E13]/70 border border-[#D8C4AC]/60'
                    }`}
                  >
                    Online / E-wallet
                  </button>
                </div>
              </div>

              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between text-[#4D0E13]/60 font-medium">
                  <span>Subtotal</span>
                  <span className="font-serif text-[#4D0E13]">₱ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#4D0E13]/60 font-medium">
                  <span>Fulfillment</span>
                  <span className="font-semibold text-[#4D0E13] capitalize">{orderType}</span>
                </div>
                <div className="border-t border-[#D8C4AC]/40 pt-3 flex justify-between items-center text-[#4D0E13]">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-serif font-bold text-xl">₱ {total.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="w-full bg-[#4D0E13] text-[#F5EFE6] py-3.5 rounded-full font-bold tracking-wide text-sm shadow-lg shadow-[#4D0E13]/20 hover:bg-[#3a0a0e] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
              >
                Place Order
              </button>
            </div>

          </motion.div>

          <DrinkCustomizationModal
            open={Boolean(customizingItem)}
            item={customizingItem}
            onClose={() => setCustomizingItem(null)}
            onSave={(customization) => {
              if (!customizingItem) return;
              updateCartItemCustomization(customizingItem.cartItemId, customization);
              setCustomizingItem(null);
              toast.success('Drink customization updated.');
            }}
          />
        </>
      )}

      {checkoutSuccess && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/35 backdrop-blur-sm z-[60]"
            onClick={() => setCheckoutSuccess(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md bg-white/95 border border-white/70 shadow-2xl rounded-[1.8rem] p-6 z-[61]"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={22} />
              </span>
              <div>
                <h3 className="font-serif text-2xl text-[#4D0E13] leading-tight">Order Submitted</h3>
                <p className="text-sm text-[#4D0E13]/65 mt-1">Order #{checkoutSuccess.orderNumber} is now waiting for cashier approval.</p>
                <p className="text-xs text-[#4D0E13]/55 mt-2 capitalize">Fulfillment: {checkoutSuccess.orderType}</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-[#D8C4AC]/40 bg-[#F5EFE6]/70 p-3">
              <p className="text-xs font-semibold text-[#4D0E13]/80">Please wait for your order number to appear on the dedicated tracking display.</p>
            </div>

            <button
              onClick={() => setCheckoutSuccess(null)}
              className="mt-5 w-full px-4 py-2.5 rounded-full bg-[#4D0E13] text-[#EEE4DA] text-sm font-bold"
            >
              Done
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}