import { motion } from 'framer-motion';
import { Coffee, CheckCircle, Package, Clock, ArrowRight } from 'lucide-react';
import { useAppStore, type OrderStatus } from '../store';
import { NavLink, useNavigate, useParams } from 'react-router';

const STATUS_STEPS: { id: OrderStatus; label: string; icon: any }[] = [
  { id: 'pending', label: 'Order Placed', icon: Clock },
  { id: 'preparing', label: 'Preparing', icon: Coffee },
  { id: 'ready', label: 'Ready for Pickup', icon: Package },
  { id: 'completed', label: 'Completed', icon: CheckCircle },
];

export function OrderTracking() {
  const navigate = useNavigate();
  const { orderId: routeOrderId } = useParams();
  const { orders, currentOrderId, getOrder, getActiveOrders } = useAppStore();

  const activeOrders = getActiveOrders();
  const fallbackOrderId = activeOrders[0]?.id ?? currentOrderId ?? orders[0]?.id ?? null;
  const selectedOrderId = routeOrderId ?? fallbackOrderId;
  const order = selectedOrderId ? getOrder(selectedOrderId) : null;

  const switchOrder = (nextOrderId: string) => {
    navigate(`/track/${nextOrderId}`);
  };

  if (!order || order.status === 'completed') {
    return (
      <div className="container mx-auto px-6 max-w-4xl py-24 min-h-[70vh] flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/60 backdrop-blur-xl border border-white/50 p-12 rounded-[3rem] shadow-xl shadow-[#D8C4AC]/20 w-full max-w-lg"
        >
          {order?.status === 'completed' ? (
            <>
              <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-100">
                <CheckCircle size={40} className="text-emerald-500" />
              </div>
              <h2 className="text-3xl font-serif text-[#4D0E13] mb-2 tracking-tight">Order Complete!</h2>
              <p className="text-[#4D0E13]/50 text-sm font-semibold uppercase tracking-widest mb-2">#{order.orderNumber}</p>
              <p className="text-[#4D0E13]/60 mb-8 font-medium">Thank you for visiting Aura Café. We hope to see you again soon! ☕</p>
              {activeOrders.length > 0 && (
                <div className="mb-6 text-left">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#4D0E13]/45 mb-2 text-center">Track another active order</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {activeOrders.map((active) => (
                      <button
                        key={active.id}
                        onClick={() => switchOrder(active.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold bg-white border border-[#D8C4AC]/50 text-[#4D0E13] hover:bg-[#F5EFE6] transition-colors"
                      >
                        #{active.orderNumber}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="w-24 h-24 bg-[#D8C4AC]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Coffee size={40} className="text-[#4D0E13]/40" />
              </div>
              <h2 className="text-3xl font-serif text-[#4D0E13] mb-4 tracking-tight">No Active Orders</h2>
              <p className="text-[#4D0E13]/60 mb-8 font-medium">You don't have any active orders at the moment. Would you like to explore our menu?</p>
            </>
          )}
          <NavLink 
            to="/menu"
            className="inline-flex items-center justify-center gap-2 bg-[#4D0E13] hover:bg-[#3a0a0e] text-[#EEE4DA] px-8 py-4 rounded-full font-bold shadow-lg transition-all hover:scale-105 active:scale-95"
          >
            View Menu <ArrowRight size={18} />
          </NavLink>
        </motion.div>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.id === order.status);

  return (
    <div className="container mx-auto px-6 max-w-3xl py-12 md:py-20 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/70 backdrop-blur-2xl border border-white/60 p-8 md:p-12 rounded-[3rem] shadow-2xl shadow-[#D8C4AC]/30 relative overflow-hidden"
      >
        {/* Decorative background blob */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C8A49F]/10 blur-[40px] rounded-full -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative z-10">
          {activeOrders.length > 1 && (
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4D0E13]/45 mb-2">Active Orders</p>
              <div className="flex flex-wrap gap-2">
                {activeOrders.map((active) => (
                  <button
                    key={active.id}
                    onClick={() => switchOrder(active.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                      active.id === order.id
                        ? 'bg-[#4D0E13] text-[#EEE4DA] border-[#4D0E13]'
                        : 'bg-white/70 text-[#4D0E13] border-[#D8C4AC]/50 hover:bg-[#F5EFE6]'
                    }`}
                  >
                    #{active.orderNumber}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-[#D8C4AC]/30 text-[#4D0E13] rounded-full text-sm font-bold uppercase tracking-widest mb-4">
              Order #{order.orderNumber}
            </span>
            <h1 className="text-4xl md:text-5xl font-serif text-[#4D0E13] tracking-tight mb-3">Order Status</h1>
            <p className="text-[#4D0E13]/60 font-medium">
              Estimated wait time: ~{order.estimatedTime} mins
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="relative mb-16 px-4 md:px-8">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-[#D8C4AC]/30 rounded-full" />
            <motion.div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-[#4D0E13] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            
            <div className="relative flex justify-between">
              {STATUS_STEPS.map((step, index) => {
                const isActive = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const StepIcon = step.icon;
                
                return (
                  <div key={step.id} className="flex flex-col items-center">
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: index * 0.15 }}
                      className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center relative z-10 transition-colors duration-500 shadow-md ${
                        isActive 
                          ? 'bg-[#4D0E13] text-[#EEE4DA] border-4 border-white' 
                          : 'bg-white text-[#D8C4AC] border-4 border-[#EEE4DA]'
                      } ${isCurrent ? 'ring-4 ring-[#C8A49F]/30' : ''}`}
                    >
                      <StepIcon size={24} className={isActive ? 'animate-pulse' : ''} />
                    </motion.div>
                    <span className={`mt-3 text-xs md:text-sm font-bold absolute -bottom-8 w-24 text-center ${
                      isActive ? 'text-[#4D0E13]' : 'text-[#4D0E13]/40'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Details */}
          <div className="bg-[#EEE4DA]/50 rounded-3xl p-6 md:p-8 border border-[#D8C4AC]/20">
            <h3 className="font-serif text-2xl text-[#4D0E13] mb-6">Order Details</h3>
            <div className="space-y-4 mb-6">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-[#4D0E13] font-bold shadow-sm">
                      {item.quantity}x
                    </div>
                    <span className="font-medium text-[#4D0E13]/80">{item.name}</span>
                  </div>
                  <span className="font-bold text-[#4D0E13]">₱{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            
            <div className="pt-4 border-t border-[#D8C4AC]/30 flex justify-between items-center">
              <span className="text-[#4D0E13]/60 font-medium">Total</span>
              <span className="font-serif text-2xl text-[#4D0E13]">₱{order.total.toFixed(2)}</span>
            </div>
          </div>
          
          {order.status === 'ready' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 bg-[#C8A49F]/20 border border-[#C8A49F]/40 rounded-2xl p-6 text-center"
            >
              <h4 className="font-bold text-[#4D0E13] text-lg mb-1">Your order is ready!</h4>
              <p className="text-[#4D0E13]/70 font-medium">Please head to the pickup counter with your order number.</p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}