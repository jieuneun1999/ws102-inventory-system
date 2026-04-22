import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../ui/chart';

const revenueData = [
  { name: 'Sun', value: 6850 },
  { name: 'Mon', value: 3400 },
  { name: 'Tue', value: 4200 },
  { name: 'Wed', value: 3100 },
  { name: 'Thu', value: 5800 },
  { name: 'Fri', value: 8500 },
  { name: 'Sat', value: 11000 },
];

const bestSellers = [
  { name: 'Latte', sold: 124 },
  { name: 'Americano', sold: 98 },
  { name: 'Espresso', sold: 85 },
  { name: 'Mocha', sold: 64 },
  { name: 'Flat White', sold: 52 },
];

const metrics = [
  {
    title: 'Revenue',
    value: '₱84,320',
    trend: '+4.32% vs last month',
  },
  {
    title: 'Sales',
    value: '432',
    trend: '+4.32% vs last month',
  },
  {
    title: 'Last Seven Days',
    value: '124',
    trend: 'Total all orders',
  },
  {
    title: 'Units Sold',
    value: '1,234',
    trend: '+4.32% vs last month',
  },
];

const chartConfig = {
  value: {
    label: "Revenue",
    color: "#4D0E13",
  },
};

export function AnalyticsView() {
  const maxSold = Math.max(...bestSellers.map(item => item.sold));

  return (
    <div className="flex flex-col gap-6 w-full pb-10 pt-4">
      {/* Metrics Cards - 4 in a row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.4 }}
            key={`metric-${metric.title}`}
            className="bg-white/60 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgba(77,14,19,0.03)] p-5 rounded-[1.5rem] flex flex-col gap-2"
          >
            <div className="text-[#4D0E13]/50 text-sm font-bold uppercase tracking-wider">
              {metric.title}
            </div>
            <div className="text-3xl font-serif text-[#4D0E13] font-medium">
              {metric.value}
            </div>
            <div className="text-xs text-[#4D0E13]/40">
              {metric.trend}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid - Line chart left, Best Seller right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue Graph */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-white/60 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgba(77,14,19,0.03)] p-6 rounded-[2rem] flex flex-col h-[400px]"
        >
          <h3 className="text-xl font-serif text-[#4D0E13] font-medium mb-6">Revenue Graph</h3>

          <div className="flex-1 w-full relative">
            <ChartContainer id="revenue-line-chart" config={chartConfig} className="w-full h-full min-h-[250px]">
              <LineChart data={revenueData} margin={{ top: 10, right: 20, left: -20, bottom: 10 }}>
                <CartesianGrid key="line-grid" strokeDasharray="3 3" vertical={false} stroke="#D8C4AC" strokeOpacity={0.4} />
                <XAxis
                  key="line-xaxis"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#4D0E13', opacity: 0.6, fontSize: 13, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis
                  key="line-yaxis"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#4D0E13', opacity: 0.6, fontSize: 13, fontWeight: 600 }}
                  tickFormatter={(val) => `₱${val}`}
                />
                <ChartTooltip
                  key="line-tooltip"
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <Line
                  key="line-data"
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-value)"
                  strokeWidth={3}
                  dot={{ fill: 'var(--color-value)', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ChartContainer>
          </div>
        </motion.div>

        {/* Best Seller */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="bg-white/60 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgba(77,14,19,0.03)] p-6 rounded-[2rem] flex flex-col h-[400px]"
        >
          <h3 className="text-xl font-serif text-[#4D0E13] font-medium mb-6">Best Seller</h3>

          <div className="flex flex-col flex-1 gap-5">
            {bestSellers.map((item, idx) => (
              <div key={`best-seller-${item.name}`} className="flex items-center gap-4">
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-[#4D0E13]">{item.name}</span>
                    <span className="text-sm font-bold text-[#4D0E13]/60">{item.sold}</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#D8C4AC]/30 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.sold / maxSold) * 100}%` }}
                      transition={{ delay: 0.5 + (idx * 0.1), duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-[#4D0E13] rounded-full"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
