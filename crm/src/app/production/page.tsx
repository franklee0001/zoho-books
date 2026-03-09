import { prisma } from "@/lib/prisma";
import Link from "next/link";
import StatsCard from "@/components/stats-card";
import SyncButton from "./sync-button";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(d));
}

const statusBadge: Record<string, string> = {
  confirmed: "bg-yellow-100 text-yellow-700",
  producing: "bg-blue-100 text-blue-700",
  checking: "bg-cyan-100 text-cyan-700",
  packing: "bg-green-100 text-green-700",
  shipped: "bg-purple-100 text-purple-700",
};

function getDDayText(deadline: Date): { text: string; className: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { text: `D+${Math.abs(diff)}`, className: "text-red-600 font-medium" };
  if (diff === 0) return { text: "D-Day", className: "text-red-600 font-medium" };
  if (diff <= 3) return { text: `D-${diff}`, className: "text-orange-600 font-medium" };
  return { text: `D-${diff}`, className: "text-gray-500" };
}

export default async function ProductionDashboard() {
  const locale = await getLocale();
  let error: string | null = null;
  let stats = { total: 0, confirmed: 0, producing: 0, checking: 0, packing: 0, shipped: 0 };
  let newPaidCount = 0;

  type DeadlineOrder = {
    id: number;
    invoice_id: string;
    status: string;
    shipping_deadline: Date | null;
    invoice: { invoice_number: string | null; customer_name: string | null } | null;
  };
  let weekDeadlines: DeadlineOrder[] = [];

  type CategoryQueue = { category_slug: string; total: number; done: number };
  let categoryQueues: CategoryQueue[] = [];

  type LogEntry = {
    id: number;
    old_status: string | null;
    new_status: string;
    changed_by: string;
    note: string | null;
    changed_at: Date;
    production_order_id: number;
    productionOrder: { id: number; invoice: { invoice_number: string | null } | null } | null;
  };
  let recentLogs: LogEntry[] = [];

  try {
    const [counts, paidCount, deadlines, categoryData, logsResult] = await Promise.all([
      prisma.productionOrder.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.invoice.count({
        where: {
          status: "paid",
          lineItems: { some: {} },
          productionOrder: null,
        },
      }),
      // This week's deadlines
      (() => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);

        return prisma.productionOrder.findMany({
          where: {
            shipping_deadline: { gte: startOfWeek, lt: endOfWeek },
            status: { notIn: ["shipped"] },
          },
          include: {
            invoice: { select: { invoice_number: true, customer_name: true } },
          },
          orderBy: { shipping_deadline: "asc" },
        });
      })(),
      // Category queue: count done/total per category
      prisma.productionUnit.groupBy({
        by: ["category_slug"],
        _count: { id: true },
        where: {
          productionOrder: { status: { notIn: ["shipped"] } },
        },
      }).then(async (groups) => {
        const doneGroups = await prisma.productionUnit.groupBy({
          by: ["category_slug"],
          _count: { id: true },
          where: {
            is_completed: true,
            productionOrder: { status: { notIn: ["shipped"] } },
          },
        });
        const doneMap: Record<string, number> = {};
        for (const g of doneGroups) {
          doneMap[g.category_slug] = g._count.id;
        }
        return groups.map((g) => ({
          category_slug: g.category_slug,
          total: g._count.id,
          done: doneMap[g.category_slug] ?? 0,
        }));
      }),
      prisma.productionStatusLog.findMany({
        orderBy: { changed_at: "desc" },
        take: 15,
        include: {
          productionOrder: {
            select: {
              id: true,
              invoice: { select: { invoice_number: true } },
            },
          },
        },
      }),
    ]);

    let total = 0;
    for (const g of counts) {
      const count = g._count.status;
      total += count;
      if (g.status in stats) {
        stats[g.status as keyof typeof stats] = count;
      }
    }
    stats.total = total;
    newPaidCount = paidCount;
    weekDeadlines = deadlines;
    categoryQueues = categoryData;
    recentLogs = logsResult;
  } catch (e) {
    error = e instanceof Error ? e.message : "DB connection failed";
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t(locale, "production.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t(locale, "production.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/production/board"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t(locale, "production.kanbanBoard")}
          </Link>
          <Link
            href="/production/calendar"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t(locale, "production.calendar")}
          </Link>
          <SyncButton locale={locale} />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <p className="font-semibold text-amber-800">{t(locale, "common.dbNotConnected")}</p>
          <p className="text-amber-700 mt-1">{error}</p>
        </div>
      )}

      {/* Alert banner for new paid invoices */}
      {newPaidCount > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
          <p className="text-sm font-medium text-blue-800">
            {t(locale, "production.newPaidAlert", { count: newPaidCount })}
          </p>
          <SyncButton locale={locale} />
        </div>
      )}

      {/* Stats: 5-stage */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatsCard title={t(locale, "production.confirmed")} value={String(stats.confirmed)} trend="neutral" />
        <StatsCard title={t(locale, "production.producing")} value={String(stats.producing)} trend="up" />
        <StatsCard title={t(locale, "production.checking")} value={String(stats.checking)} trend="neutral" />
        <StatsCard title={t(locale, "production.packing")} value={String(stats.packing)} trend="neutral" />
        <StatsCard
          title={t(locale, "production.shipped")}
          value={String(stats.shipped)}
          subtitle={stats.shipped > 0 ? t(locale, "production.shippedCount", { count: stats.shipped }) : undefined}
          trend="up"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Queue */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {t(locale, "production.categoryQueue")}
            </h2>
          </div>
          <div className="px-6 py-4 space-y-3">
            {categoryQueues.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">{t(locale, "production.noActivity")}</p>
            ) : (
              categoryQueues.map((cq) => {
                const pct = cq.total > 0 ? Math.round((cq.done / cq.total) * 100) : 0;
                return (
                  <div key={cq.category_slug}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{t(locale, `category.${cq.category_slug}`)}</span>
                      <span className="text-gray-500">{cq.done}/{cq.total}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Week deadlines */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {t(locale, "production.weekDeadlines")}
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {weekDeadlines.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">
                {t(locale, "production.noDeadlines")}
              </div>
            ) : (
              weekDeadlines.map((order) => {
                const dd = order.shipping_deadline ? getDDayText(order.shipping_deadline) : null;
                return (
                  <div key={order.id} className="px-6 py-3 flex items-center justify-between">
                    <div>
                      <Link
                        href={`/production/${order.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {order.invoice?.invoice_number ?? order.invoice_id.slice(0, 8)}
                      </Link>
                      <p className="text-xs text-gray-500">{order.invoice?.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {t(locale, `status.${order.status}`)}
                      </span>
                      {dd && (
                        <p className={`text-xs mt-0.5 ${dd.className}`}>
                          {formatDate(order.shipping_deadline)} ({dd.text})
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t(locale, "production.recentActivity")}</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentLogs.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">
                {t(locale, "production.noActivity")}
              </div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="px-6 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                      <span className="font-medium">{log.changed_by}</span>
                      {` ${t(locale, "production.changed")} `}
                      <Link
                        href={`/production/${log.productionOrder?.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {log.productionOrder?.invoice?.invoice_number ?? `#${log.production_order_id}`}
                      </Link>
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Intl.DateTimeFormat("ko-KR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(log.changed_at))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {log.old_status && (
                      <>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[log.old_status] ?? "bg-gray-100 text-gray-600"}`}>
                          {t(locale, `status.${log.old_status}`)}
                        </span>
                        <span className="text-xs text-gray-400">&rarr;</span>
                      </>
                    )}
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[log.new_status] ?? "bg-gray-100 text-gray-600"}`}>
                      {t(locale, `status.${log.new_status}`)}
                    </span>
                    {log.note && (
                      <span className="text-xs text-gray-400 truncate max-w-[200px]">
                        — {log.note}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
