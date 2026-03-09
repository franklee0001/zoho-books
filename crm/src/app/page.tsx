import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import StatsCard from "@/components/stats-card";
import MonthlyRevenueChart from "@/components/monthly-revenue-chart";
import Link from "next/link";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";

function formatCurrency(val: unknown): string {
  if (val == null) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(val));
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ko-KR").format(new Date(d));
}

const statusBadge: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  sent: "bg-blue-100 text-blue-700",
  overdue: "bg-red-100 text-red-700",
  draft: "bg-gray-100 text-gray-600",
  void: "bg-yellow-100 text-yellow-700",
  partially_paid: "bg-orange-100 text-orange-700",
};

export const dynamic = "force-dynamic";

async function fetchData() {
  try {
    const [totalInvoices, totalCustomers, invoices, aggregation, invoicedRaw] =
      await Promise.all([
        prisma.invoice.count(),
        prisma.customer.count(),
        prisma.invoice.findMany({
          take: 10,
          orderBy: { date: "desc" },
          include: { customer: true },
        }),
        prisma.invoice.aggregate({
          _sum: { total: true, balance: true },
        }),
        prisma.$queryRaw<{ month: string; invoiced: Prisma.Decimal }[]>(
          Prisma.sql`SELECT TO_CHAR(date, 'YYYY-MM') as month, SUM(total) as invoiced
            FROM invoices
            WHERE date IS NOT NULL AND status != 'void'
            GROUP BY TO_CHAR(date, 'YYYY-MM')
            ORDER BY month`
        ),
      ]);

    // collected 쿼리는 테이블 미존재 시에도 대시보드가 동작하도록 별도 처리
    let collectedRaw: { month: string; collected: Prisma.Decimal }[] = [];
    try {
      collectedRaw = await prisma.$queryRaw<{ month: string; collected: Prisma.Decimal }[]>(
        Prisma.sql`SELECT TO_CHAR(date, 'YYYY-MM') as month, SUM(amount) as collected
          FROM customer_payments
          WHERE date IS NOT NULL
          GROUP BY TO_CHAR(date, 'YYYY-MM')
          ORDER BY month`
      );
    } catch {
      // payment tables not yet migrated — show invoiced only
    }

    // Merge invoiced + collected by month
    const monthMap = new Map<string, { invoiced: number; collected: number }>();
    for (const r of invoicedRaw) {
      monthMap.set(r.month, { invoiced: Number(r.invoiced), collected: 0 });
    }
    for (const r of collectedRaw) {
      const existing = monthMap.get(r.month);
      if (existing) {
        existing.collected = Number(r.collected);
      } else {
        monthMap.set(r.month, { invoiced: 0, collected: Number(r.collected) });
      }
    }
    const monthlyRevenue = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({ month, ...vals }));

    return { totalInvoices, totalCustomers, invoices, aggregation, monthlyRevenue, error: null };
  } catch (e) {
    return {
      totalInvoices: 0,
      totalCustomers: 0,
      invoices: [] as Awaited<ReturnType<typeof prisma.invoice.findMany<{ include: { customer: true } }>>>,
      aggregation: { _sum: { total: null, balance: null } },
      monthlyRevenue: [] as { month: string; invoiced: number; collected: number }[],
      error: e instanceof Error ? e.message : "DB connection failed",
    };
  }
}

export default async function DashboardPage() {
  const locale = await getLocale();
  const { totalInvoices, totalCustomers, invoices, aggregation, monthlyRevenue, error } =
    await fetchData();

  const totalRevenue = aggregation._sum.total;
  const totalBalance = aggregation._sum.balance;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t(locale, "dashboard.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t(locale, "dashboard.subtitle")}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <p className="font-semibold text-amber-800">{t(locale, "common.dbNotConnected")}</p>
          <p className="text-amber-700 mt-1">{t(locale, "common.dbNotConnectedDesc")}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard title={t(locale, "dashboard.totalRevenue")} value={formatCurrency(totalRevenue)} />
        <StatsCard
          title={t(locale, "dashboard.outstandingBalance")}
          value={formatCurrency(totalBalance)}
          trend="down"
        />
        <StatsCard title={t(locale, "dashboard.invoices")} value={totalInvoices.toLocaleString()} />
        <StatsCard title={t(locale, "dashboard.customers")} value={totalCustomers.toLocaleString()} />
      </div>

      <MonthlyRevenueChart data={monthlyRevenue} locale={locale} />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">{t(locale, "dashboard.recentInvoices")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "dashboard.invoiceNo")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "dashboard.customer")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "dashboard.date")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "dashboard.status")}</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-600">{t(locale, "dashboard.total")}</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-600">{t(locale, "dashboard.balance")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.invoice_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-blue-600">
                    <Link href={`/invoices/${inv.invoice_id}`}>{inv.invoice_number ?? "—"}</Link>
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {inv.customer?.customer_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(inv.date)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        statusBadge[inv.status ?? ""] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {inv.status ?? "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {formatCurrency(inv.total)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500">
                    {formatCurrency(inv.balance)}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    {error ? t(locale, "dashboard.connectDb") : t(locale, "dashboard.noInvoices")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
