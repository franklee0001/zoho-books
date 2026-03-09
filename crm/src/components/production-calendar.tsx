"use client";

import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";

interface CalendarOrder {
  id: number;
  invoice_id: string;
  invoice_number: string | null;
  customer_name: string | null;
  status: string;
  target_date: string;
}

interface ProductionCalendarProps {
  orders: CalendarOrder[];
  year: number;
  month: number; // 1-based
  locale: Locale;
}

const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-yellow-400",
  producing: "bg-blue-400",
  checking: "bg-cyan-400",
  packing: "bg-green-400",
  shipped: "bg-purple-400",
};

const STATUS_BG: Record<string, string> = {
  confirmed: "bg-yellow-50 border-yellow-200 text-yellow-800",
  producing: "bg-blue-50 border-blue-200 text-blue-800",
  checking: "bg-cyan-50 border-cyan-200 text-cyan-800",
  packing: "bg-green-50 border-green-200 text-green-800",
  shipped: "bg-purple-50 border-purple-200 text-purple-800",
};

function getWeekdays(locale: Locale): string[] {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map(
    (d) => t(locale, `calendar.${d}`)
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function ProductionCalendar({
  orders,
  year,
  month,
  locale,
}: ProductionCalendarProps) {
  const weekdays = getWeekdays(locale);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // Group orders by date
  const ordersByDate: Record<string, CalendarOrder[]> = {};
  for (const order of orders) {
    const dateKey = order.target_date.slice(0, 10);
    if (!ordersByDate[dateKey]) ordersByDate[dateKey] = [];
    ordersByDate[dateKey].push(order);
  }

  // Build calendar grid
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = month === 1 ? `?month=${year - 1}-12` : `?month=${year}-${pad(month - 1)}`;
  const nextMonth = month === 12 ? `?month=${year + 1}-01` : `?month=${year}-${pad(month + 1)}`;

  return (
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/production/calendar${prevMonth}`}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          &lsaquo; {t(locale, "calendar.prev")}
        </Link>
        <h2 className="text-lg font-semibold text-gray-900">
          {year}. {pad(month)}
        </h2>
        <Link
          href={`/production/calendar${nextMonth}`}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {t(locale, "calendar.next")} &rsaquo;
        </Link>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        {Object.entries(STATUS_DOT).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span>{t(locale, `status.${status}`)}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {weekdays.map((day, idx) => (
            <div
              key={idx}
              className="px-2 py-2 text-center text-xs font-semibold text-gray-500"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={idx} className="border-b border-r border-gray-100 min-h-[100px] bg-gray-50/50" />;
            }

            const dateStr = `${year}-${pad(month)}-${pad(day)}`;
            const dayOrders = ordersByDate[dateStr] ?? [];
            const isToday = dateStr === todayStr;

            return (
              <div
                key={idx}
                className={`border-b border-r border-gray-100 min-h-[100px] p-1.5 ${
                  isToday ? "bg-blue-50/50" : ""
                }`}
              >
                <div className={`text-xs font-medium mb-1 ${isToday ? "text-blue-600" : "text-gray-400"}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayOrders.slice(0, 4).map((order) => (
                    <Link
                      key={order.id}
                      href={`/production/${order.id}`}
                      className={`block text-xs px-1.5 py-0.5 rounded border truncate hover:opacity-80 ${STATUS_BG[order.status] ?? "bg-gray-50 border-gray-200 text-gray-700"}`}
                      title={`${order.invoice_number} - ${order.customer_name}`}
                    >
                      {order.invoice_number ?? order.invoice_id.slice(0, 8)}
                    </Link>
                  ))}
                  {dayOrders.length > 4 && (
                    <div className="text-xs text-gray-400 px-1.5">
                      {t(locale, "calendar.moreOrders", { count: dayOrders.length - 4 })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
