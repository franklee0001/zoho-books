"use client";

import Link from "next/link";
import StatusUpdateButton from "./status-update-button";
import { t, type Locale } from "@/lib/i18n";

interface LineItemSummary {
  name: string | null;
  quantity: number;
}

interface UnitSummary {
  total: number;
  done: number;
}

interface OrderCard {
  id: number;
  invoice_id: string;
  invoice_number: string | null;
  customer_name: string | null;
  status: string;
  priority: number;
  shipping_deadline: string | null;
  notes: string | null;
  lineItems: LineItemSummary[];
  unitProgress: UnitSummary;
}

interface ProductionBoardProps {
  orders: OrderCard[];
  locale: Locale;
}

const COLUMNS = [
  { key: "confirmed", labelKey: "status.confirmed", color: "border-yellow-400", bg: "bg-yellow-50" },
  { key: "producing", labelKey: "status.producing", color: "border-blue-400", bg: "bg-blue-50" },
  { key: "checking", labelKey: "status.checking", color: "border-cyan-400", bg: "bg-cyan-50" },
  { key: "packing", labelKey: "status.packing", color: "border-green-400", bg: "bg-green-50" },
  { key: "shipped", labelKey: "status.shipped", color: "border-purple-400", bg: "bg-purple-50" },
];

function getDeadlineWarning(deadline: string | null, status: string): "red" | "orange" | null {
  if (!deadline || status === "shipped") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "red";
  if (diff <= 3) return "orange";
  return null;
}

function formatDate(d: string | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(
    new Date(d)
  );
}

export default function ProductionBoard({ orders, locale }: ProductionBoardProps) {
  const grouped = COLUMNS.map((col) => ({
    ...col,
    orders: orders
      .filter((o) => o.status === col.key)
      .sort((a, b) => b.priority - a.priority),
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
      {grouped.map((col) => (
        <div key={col.key} className="flex flex-col">
          <div className={`rounded-t-lg border-t-4 ${col.color} ${col.bg} px-4 py-3`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                {t(locale, col.labelKey)}
              </h3>
              <span className="text-sm text-gray-500 font-medium">
                {col.orders.length}
              </span>
            </div>
          </div>
          <div className="flex-1 bg-gray-50 rounded-b-lg p-2 space-y-2 min-h-[200px]">
            {col.orders.map((order) => {
              const warning = getDeadlineWarning(order.shipping_deadline, order.status);
              const pct = order.unitProgress.total > 0
                ? Math.round((order.unitProgress.done / order.unitProgress.total) * 100)
                : 0;

              return (
                <Link
                  key={order.id}
                  href={`/production/${order.id}`}
                  className={`block bg-white rounded-lg border shadow-sm p-3 hover:shadow-md transition-shadow ${
                    warning === "red"
                      ? "border-red-300 ring-1 ring-red-200"
                      : warning === "orange"
                      ? "border-orange-300 ring-1 ring-orange-200"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {order.invoice_number ?? order.invoice_id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-500 truncate max-w-[140px]">
                        {order.customer_name ?? "—"}
                      </p>
                    </div>
                    {order.priority > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                        P{order.priority}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {order.unitProgress.total > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-gray-500">
                          {t(locale, "production.progress", {
                            done: order.unitProgress.done,
                            total: order.unitProgress.total,
                          })}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct === 100 ? "bg-green-500" : "bg-blue-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {order.shipping_deadline && (
                    <p
                      className={`text-xs mb-2 ${
                        warning === "red"
                          ? "text-red-600 font-medium"
                          : warning === "orange"
                          ? "text-orange-600 font-medium"
                          : "text-gray-400"
                      }`}
                    >
                      {t(locale, "production.shippingDeadline")}: {formatDate(order.shipping_deadline)}
                    </p>
                  )}

                  {order.lineItems.length > 0 && (
                    <div className="mb-2">
                      {order.lineItems.slice(0, 2).map((li, idx) => (
                        <p key={idx} className="text-xs text-gray-500 truncate">
                          {li.name ?? "Item"} x{li.quantity}
                        </p>
                      ))}
                      {order.lineItems.length > 2 && (
                        <p className="text-xs text-gray-400">
                          {t(locale, "board.moreItems", { count: order.lineItems.length - 2 })}
                        </p>
                      )}
                    </div>
                  )}

                  <div onClick={(e) => e.preventDefault()}>
                    <StatusUpdateButton
                      orderId={order.id}
                      currentStatus={order.status}
                      compact
                      locale={locale}
                    />
                  </div>
                </Link>
              );
            })}
            {col.orders.length === 0 && (
              <div className="text-center text-sm text-gray-400 py-8">
                {t(locale, "board.noOrders")}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
