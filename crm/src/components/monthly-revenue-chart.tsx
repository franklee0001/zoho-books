"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { t, type Locale } from "@/lib/i18n";

interface MonthlyRevenueChartProps {
  data: { month: string; invoiced: number; collected: number }[];
  locale: Locale;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MonthlyRevenueChart({ data, locale }: MonthlyRevenueChartProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
      <h2 className="font-semibold text-gray-900 mb-4">{t(locale, "chart.monthlyRevenue")}</h2>
      {data.length === 0 ? (
        <p className="text-center text-gray-400 py-12">{t(locale, "chart.noData")}</p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              formatter={(value?: number, name?: string) => [
                formatCurrency(value ?? 0),
                name === "invoiced" ? t(locale, "chart.invoiced") : t(locale, "chart.collected"),
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            />
            <Legend
              formatter={(value: string) =>
                value === "invoiced" ? t(locale, "chart.invoiced") : t(locale, "chart.collected")
              }
            />
            <Bar dataKey="invoiced" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="collected" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
