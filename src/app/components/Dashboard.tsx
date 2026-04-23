import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../contexts/AppContext';
import {
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Coffee,
  ShoppingBag,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

type TabType = 'orders' | 'inventory' | 'sales' | 'analytics';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const { user, orders, updateOrderStatus, products } = useApp();

  if (!user || (user.role !== 'admin' && user.role !== 'barista')) {
    return (
      <div className="min-h-screen pt-28 pb-16 px-4 flex items-center justify-center">
        <div className="text-center">
          <h2 style={{ fontSize: '2rem', color: 'var(--burgundy)' }}>Access Denied</h2>
          <p style={{ color: 'var(--coffee-brown)' }}>You need admin or barista access to view this page</p>
        </div>
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');
  const completedOrders = orders.filter(o => o.status === 'completed');

  const lowStockProducts = products.filter(p => p.inStock < 20);
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const todayRevenue = orders
    .filter(o => {
      const today = new Date();
      const orderDate = new Date(o.timestamp);
      return orderDate.toDateString() === today.toDateString();
    })
    .reduce((sum, o) => sum + o.total, 0);

  const handleUpdateStatus = (orderId: string, newStatus: any) => {
    updateOrderStatus(orderId, newStatus);
    const notify = newStatus === 'completed' ? toast.success : toast.info;
    notify(`Order ${orderId} updated to ${newStatus}`);
  };

  // Mock data for charts - memoized to prevent re-renders
  const salesData = useMemo(() => [
    { name: 'Mon', sales: 1200 },
    { name: 'Tue', sales: 1900 },
    { name: 'Wed', sales: 1500 },
    { name: 'Thu', sales: 2100 },
    { name: 'Fri', sales: 2400 },
    { name: 'Sat', sales: 3200 },
    { name: 'Sun', sales: 2800 },
  ], []);

  const monthlySales = useMemo(() => [
    { name: 'Jan', sales: 25000 },
    { name: 'Feb', sales: 28000 },
    { name: 'Mar', sales: 32000 },
    { name: 'Apr', sales: 30000 },
  ], []);

  const topProducts = useMemo(() => products
    .map((p, idx) => ({
      id: p.id,
      name: p.name,
      sales: Math.floor((idx + 1) * 15) + 20,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5), [products]);

  const categoryData = useMemo(() => [
    { id: 'cat-coffee', name: 'Coffee', value: products.filter(p => p.category === 'coffee').length },
    { id: 'cat-non-coffee', name: 'Non-Coffee', value: products.filter(p => p.category === 'non-coffee').length },
    { id: 'cat-pastries', name: 'Pastries', value: products.filter(p => p.category === 'pastries').length },
  ], [products]);

  const COLORS = ['#6B1B1B', '#C9A5A5', '#E8D5C4'];

  const tabs = [
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'sales', label: 'Sales', icon: DollarSign },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen pt-28 pb-16 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 style={{ fontSize: '3rem', fontWeight: 600, color: 'var(--burgundy)' }}>
              Dashboard
            </h1>
            <p style={{ color: 'var(--coffee-brown)', opacity: 0.8 }}>
              Welcome back, {user.name}
            </p>
          </div>
          {pendingOrders.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-burgundy text-white">
              <Bell size={20} />
              <span>{pendingOrders.length} New Orders</span>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-6 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
            style={{ backdropFilter: 'blur(10px)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--coffee-brown)', opacity: 0.8 }}>Pending Orders</span>
              <Clock size={24} style={{ color: 'var(--burgundy)' }} />
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--burgundy)' }}>
              {pendingOrders.length}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-6 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
            style={{ backdropFilter: 'blur(10px)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--coffee-brown)', opacity: 0.8 }}>Today's Revenue</span>
              <DollarSign size={24} style={{ color: 'var(--burgundy)' }} />
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--burgundy)' }}>
              ${todayRevenue.toFixed(2)}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-6 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
            style={{ backdropFilter: 'blur(10px)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--coffee-brown)', opacity: 0.8 }}>Low Stock Items</span>
              <AlertTriangle size={24} style={{ color: 'var(--burgundy)' }} />
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--burgundy)' }}>
              {lowStockProducts.length}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-6 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
            style={{ backdropFilter: 'blur(10px)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--coffee-brown)', opacity: 0.8 }}>Total Revenue</span>
              <TrendingUp size={24} style={{ color: 'var(--burgundy)' }} />
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--burgundy)' }}>
              ${totalRevenue.toFixed(2)}
            </p>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-4 mb-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-6 py-3 rounded-full backdrop-blur-md border transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-burgundy text-white border-burgundy shadow-lg scale-105'
                    : 'bg-white/40 border-white/30 hover:bg-white/50 hover:scale-105'
                }`}
                style={activeTab !== tab.id ? { color: 'var(--coffee-brown)' } : {}}
              >
                <Icon size={20} />
                <span style={{ fontWeight: activeTab === tab.id ? 600 : 500 }}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <h2 style={{ fontSize: '2rem', color: 'var(--burgundy)', marginBottom: '1rem' }}>
              Order Management
            </h2>
            {orders.length === 0 ? (
              <p style={{ color: 'var(--coffee-brown)', opacity: 0.8 }}>No orders yet</p>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-6 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
                    style={{ backdropFilter: 'blur(10px)' }}
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                      <div>
                        <h3 style={{ fontSize: '1.25rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                          {order.id}
                        </h3>
                        {order.customerName && (
                          <p style={{ color: 'var(--coffee-brown)' }}>
                            Customer: {order.customerName}
                          </p>
                        )}
                        <p style={{ color: 'var(--coffee-brown)', opacity: 0.6, fontSize: '0.875rem' }}>
                          {order.timestamp.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'preparing')}
                            className="px-4 py-2 rounded-full bg-burgundy text-white hover:bg-burgundy-dark hover:scale-105 transition-all shadow-md"
                          >
                            Start Preparing
                          </button>
                        )}
                        {order.status === 'preparing' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'ready')}
                            className="px-4 py-2 rounded-full bg-burgundy text-white hover:bg-burgundy-dark hover:scale-105 transition-all shadow-md"
                          >
                            Mark Ready
                          </button>
                        )}
                        {order.status === 'ready' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'completed')}
                            className="px-4 py-2 rounded-full bg-burgundy text-white hover:bg-burgundy-dark hover:scale-105 transition-all shadow-md"
                          >
                            Complete Order
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      {order.items.map((item) => (
                        <div key={`${item.id}-${item.name}-${item.quantity}`} className="flex justify-between">
                          <span style={{ color: 'var(--coffee-brown)' }}>
                            {item.name} x{item.quantity}
                          </span>
                          <span style={{ color: 'var(--burgundy)', fontWeight: 600 }}>
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                      <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--burgundy)' }}>
                        Total: ${order.total.toFixed(2)}
                      </span>
                      <span
                        className="px-4 py-1 rounded-full"
                        style={{
                          backgroundColor: order.status === 'completed' ? '#10b98120' : 'var(--burgundy)20',
                          color: order.status === 'completed' ? '#10b981' : 'var(--burgundy)',
                          fontWeight: 600,
                        }}
                      >
                        {order.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <h2 style={{ fontSize: '2rem', color: 'var(--burgundy)', marginBottom: '1rem' }}>
              Inventory Management {user.role !== 'admin' && '(View Only)'}
            </h2>

            {/* Low Stock Alert */}
            {lowStockProducts.length > 0 && (
              <div
                className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-6 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
                style={{ backdropFilter: 'blur(10px)' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={24} style={{ color: 'var(--burgundy)' }} />
                  <h3 style={{ fontSize: '1.5rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                    Low Stock Alert
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lowStockProducts.map((product) => (
                    <div
                      key={product.id}
                      className="p-4 rounded-2xl bg-white/30"
                    >
                      <p style={{ color: 'var(--burgundy)', fontWeight: 600 }}>{product.name}</p>
                      <p style={{ color: 'var(--coffee-brown)', fontSize: '0.875rem' }}>
                        Stock: {product.inStock} units
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Products */}
            <div
              className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-6 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
              style={{ backdropFilter: 'blur(10px)' }}
            >
              <h3 className="mb-4" style={{ fontSize: '1.5rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                All Products
              </h3>
              <div className="space-y-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white/20"
                  >
                    <div className="flex items-center gap-4">
                      <img src={product.image} alt={product.name} className="w-16 h-16 object-cover rounded-xl" />
                      <div>
                        <p style={{ color: 'var(--burgundy)', fontWeight: 600 }}>{product.name}</p>
                        <p style={{ color: 'var(--coffee-brown)', fontSize: '0.875rem' }}>
                          {product.category}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p style={{ color: 'var(--burgundy)', fontWeight: 600 }}>
                        {product.inStock} units
                      </p>
                      <p style={{ color: 'var(--coffee-brown)', fontSize: '0.875rem' }}>
                        ${product.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="space-y-6">
            <h2 style={{ fontSize: '2rem', color: 'var(--burgundy)', marginBottom: '1rem' }}>
              Sales Overview
            </h2>

            {/* Daily Sales */}
            <div
              className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-6 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
              style={{ backdropFilter: 'blur(10px)' }}
            >
              <h3 className="mb-4" style={{ fontSize: '1.5rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                Daily Sales (This Week)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 27, 27, 0.1)" />
                  <XAxis dataKey="name" stroke="var(--coffee-brown)" />
                  <YAxis stroke="var(--coffee-brown)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid rgba(107, 27, 27, 0.2)',
                      borderRadius: '12px',
                    }}
                  />
                  <Bar dataKey="sales" fill="var(--burgundy)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Sales */}
            <div
              className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-6 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
              style={{ backdropFilter: 'blur(10px)' }}
            >
              <h3 className="mb-4" style={{ fontSize: '1.5rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                Monthly Sales Trend
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 27, 27, 0.1)" />
                  <XAxis dataKey="name" stroke="var(--coffee-brown)" />
                  <YAxis stroke="var(--coffee-brown)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid rgba(107, 27, 27, 0.2)',
                      borderRadius: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="var(--burgundy)"
                    strokeWidth={3}
                    dot={{ fill: 'var(--burgundy)', r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h2 style={{ fontSize: '2rem', color: 'var(--burgundy)', marginBottom: '1rem' }}>
              Analytics & Insights
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Products */}
              <div
                className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-6 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
                style={{ backdropFilter: 'blur(10px)' }}
              >
                <h3 className="mb-4" style={{ fontSize: '1.5rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                  Top Selling Products
                </h3>
                <div className="space-y-4">
                  {topProducts.map((product, index) => (
                    <div key={product.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'var(--burgundy)', color: 'white', fontWeight: 600 }}
                        >
                          {index + 1}
                        </div>
                        <span style={{ color: 'var(--coffee-brown)', fontWeight: 500 }}>
                          {product.name}
                        </span>
                      </div>
                      <span style={{ color: 'var(--burgundy)', fontWeight: 600 }}>
                        {product.sales} sold
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Distribution */}
              <div
                className="rounded-3xl backdrop-blur-md bg-white/30 border border-white/20 p-6 shadow-[0_8px_32px_0_rgba(107,27,27,0.1)]"
                style={{ backdropFilter: 'blur(10px)' }}
              >
                <h3 className="mb-4" style={{ fontSize: '1.5rem', color: 'var(--burgundy)', fontWeight: 600 }}>
                  Product Categories
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={entry.id} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
