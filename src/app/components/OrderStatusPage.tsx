import { motion } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import { Clock, CheckCircle, Coffee, Package } from 'lucide-react';

export function OrderStatusPage() {
  const { orders } = useApp();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={24} />;
      case 'preparing':
        return <Coffee size={24} />;
      case 'ready':
        return <Package size={24} />;
      case 'completed':
        return <CheckCircle size={24} />;
      default:
        return <Clock size={24} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'var(--dusty-pink)';
      case 'preparing':
        return 'var(--burgundy)';
      case 'ready':
        return '#10b981';
      case 'completed':
        return 'var(--coffee-brown)';
      default:
        return 'var(--dusty-pink)';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="min-h-screen pt-28 pb-16 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-5xl mx-auto"
      >
        <h1 className="mb-4 text-center" style={{ fontSize: '3rem', fontWeight: 600, color: 'var(--burgundy)' }}>
          Order Status
        </h1>
        <p className="mb-12 text-center" style={{ fontSize: '1.25rem', color: 'var(--coffee-brown)', opacity: 0.8 }}>
          Track your orders in real-time
        </p>

        {orders.length === 0 ? (
          <div className="text-center py-20">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-16 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
              style={{
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <Package size={64} style={{ color: 'var(--dusty-pink)', margin: '0 auto 1.5rem' }} />
              <h2 className="mb-4" style={{ fontSize: '2rem', color: 'var(--burgundy)' }}>
                No orders yet
              </h2>
              <p style={{ color: 'var(--coffee-brown)', opacity: 0.8 }}>
                Your order history will appear here
              </p>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-6 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)] hover:shadow-[0_12px_48px_0_rgba(107,27,27,0.15)] transition-all duration-300"
                style={{
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                  <div>
                    <h3 style={{ fontSize: '1.5rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                      {order.id}
                    </h3>
                    {order.customerName && (
                      <p style={{ color: 'var(--coffee-brown)', opacity: 0.8 }}>
                        Customer: {order.customerName}
                      </p>
                    )}
                    <p style={{ color: 'var(--coffee-brown)', opacity: 0.6, fontSize: '0.875rem' }}>
                      {order.timestamp.toLocaleString()}
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-2 mt-4 md:mt-0 px-4 py-2 rounded-full"
                    style={{ backgroundColor: getStatusColor(order.status) + '20' }}
                  >
                    <span style={{ color: getStatusColor(order.status) }}>
                      {getStatusIcon(order.status)}
                    </span>
                    <span style={{ color: getStatusColor(order.status), fontWeight: 600 }}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  {order.items.map((item) => (
                    <div key={`${item.id}-${item.name}-${item.quantity}`} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                        <div>
                          <p style={{ color: 'var(--burgundy)', fontWeight: 600 }}>
                            {item.name}
                          </p>
                          <p style={{ color: 'var(--coffee-brown)', opacity: 0.7, fontSize: '0.875rem' }}>
                            Qty: {item.quantity}
                          </p>
                        </div>
                      </div>
                      <span style={{ color: 'var(--burgundy)', fontWeight: 600 }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex justify-between">
                    <span style={{ fontSize: '1.25rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                      Total
                    </span>
                    <span style={{ fontSize: '1.25rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                      ${order.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
