import { useState } from 'react';
import { motion } from 'framer-motion';
import { DRINK_ADD_ONS, useAppStore, type OrderType } from '../store';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import type { CartItem } from '../store';
import { DrinkCustomizationModal } from './DrinkCustomizationModal';

export function CartPage() {
  const { cart, updateQuantity, removeFromCart, updateCartItemCustomization, clearCart, cartTotal, createOrder } = useAppStore();
  const [orderType, setOrderType] = useState<OrderType>('pickup');
  const [customizingItem, setCustomizingItem] = useState<CartItem | null>(null);
  const navigate = useNavigate();

  const subtotal = cartTotal();
  const total = subtotal;

  const handlePlaceOrder = () => {
    if (cart.length === 0) {
      toast.error('Your cart is empty!');
      return;
    }

    const orderId = createOrder(orderType);
    clearCart();
    toast.success('Order placed successfully! Track your order progress.', {
      style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' },
    });
    navigate(`/track/${orderId}`);
  };

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-6 py-20 min-h-[70vh] flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white/60 backdrop-blur-xl border border-white/50 p-12 rounded-[3rem] shadow-xl"
          >
            <div className="w-20 h-20 bg-[#D8C4AC]/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag size={40} className="text-[#4D0E13]/40" />
            </div>
            <h2 className="text-3xl font-serif text-[#4D0E13] mb-4 tracking-tight">
              Your cart is empty
            </h2>
            <p className="text-[#4D0E13]/60 mb-8 font-medium">
              Looks like you haven't added anything to your cart yet
            </p>
            <button
              onClick={() => navigate('/menu')}
              className="px-8 py-3 bg-[#4D0E13] text-[#EEE4DA] rounded-full font-bold hover:bg-[#3a0a0e] hover:scale-105 transition-all shadow-lg"
            >
              Browse Menu
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12 md:py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-6xl mx-auto"
      >
        <h1 className="text-4xl md:text-5xl font-serif text-[#4D0E13] mb-8 tracking-tight">
          Your Cart
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item, index) => (
              <motion.div
                key={item.cartItemId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-[2rem] p-6 shadow-md hover:shadow-xl transition-all duration-300"
              >
                <div className="flex gap-6">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-24 h-24 object-cover rounded-2xl"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-xl font-serif text-[#4D0E13] font-medium">
                          {item.name}
                        </h3>
                        <p className="text-[#4D0E13]/60 text-sm font-medium">
                          {item.description}
                        </p>
                        {item.customization && (
                          <p className="mt-1 text-xs font-medium text-[#4D0E13]/60">
                            Size: {item.customization.size} | Sugar: {item.customization.sugarLevel}%
                            {item.customization.addOnIds.length > 0
                              ? ` | Add-ons: ${item.customization.addOnIds
                                  .map((id) => DRINK_ADD_ONS.find((entry) => entry.id === id)?.name)
                                  .filter(Boolean)
                                  .join(', ')}`
                              : ''}
                          </p>
                        )}
                        {item.customization && (
                          <button
                            onClick={() => setCustomizingItem(item)}
                            className="mt-1 text-xs font-semibold text-[#4D0E13] underline-offset-2 hover:underline"
                          >
                            Customize drink
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.cartItemId)}
                        className="p-2 hover:bg-[#D8C4AC]/30 rounded-full transition-all"
                      >
                        <Trash2 size={18} className="text-[#4D0E13]" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-[#D8C4AC]/20">
                        <button
                          onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                          className="w-8 h-8 rounded-full bg-white hover:bg-[#4D0E13] hover:text-white flex items-center justify-center transition-all"
                        >
                          <Minus size={16} className="text-[#4D0E13] hover:text-white" />
                        </button>
                        <span className="text-lg font-bold text-[#4D0E13] min-w-[2rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                          className="w-8 h-8 rounded-full bg-white hover:bg-[#4D0E13] hover:text-white flex items-center justify-center transition-all"
                        >
                          <Plus size={16} className="text-[#4D0E13] hover:text-white" />
                        </button>
                      </div>
                      <span className="text-2xl font-serif font-bold text-[#4D0E13]">
                        ₱{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-[2rem] p-6 shadow-xl sticky top-28"
            >
              <h2 className="text-2xl font-serif text-[#4D0E13] mb-6 font-medium">
                Order Summary
              </h2>

              <div className="mb-6">
                <label className="block mb-2 text-[#4D0E13]/60 font-bold text-xs uppercase tracking-wider">
                  Order Type
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setOrderType('pickup')}
                    className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                      orderType === 'pickup'
                        ? 'bg-[#4D0E13] text-[#EEE4DA] shadow-md'
                        : 'bg-white text-[#4D0E13]/60 hover:text-[#4D0E13] border border-[#D8C4AC]/40'
                    }`}
                  >
                    Pickup
                  </button>
                  <button
                    onClick={() => setOrderType('delivery')}
                    className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                      orderType === 'delivery'
                        ? 'bg-[#4D0E13] text-[#EEE4DA] shadow-md'
                        : 'bg-white text-[#4D0E13]/60 hover:text-[#4D0E13] border border-[#D8C4AC]/40'
                    }`}
                  >
                    Delivery
                  </button>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-[#4D0E13]/60 font-medium">Subtotal</span>
                  <span className="text-[#4D0E13] font-bold">₱{subtotal.toFixed(2)}</span>
                </div>
                <div className="border-t border-[#D8C4AC]/30 pt-3">
                  <div className="flex justify-between">
                    <span className="text-xl font-serif text-[#4D0E13] font-medium">Total</span>
                    <span className="text-xl font-serif text-[#4D0E13] font-bold">₱{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                className="w-full px-6 py-4 rounded-full bg-[#4D0E13] text-[#EEE4DA] hover:bg-[#3a0a0e] hover:scale-105 transition-all text-lg font-bold shadow-lg hover:shadow-xl"
              >
                Place Order
              </button>

              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear your cart?')) {
                    clearCart();
                    toast.success('Cart cleared', {
                      style: { background: '#F5EFE6', color: '#4D0E13', border: '1px solid rgba(77,14,19,0.1)' },
                    });
                  }
                }}
                className="w-full mt-3 px-6 py-3 rounded-full bg-white hover:bg-[#D8C4AC]/20 transition-all text-[#4D0E13] font-bold border border-[#D8C4AC]/40"
              >
                Clear Cart
              </button>
            </motion.div>
          </div>
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
    </div>
  );
}
