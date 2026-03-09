import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ProductionCalendar from "@/components/production-calendar";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface SearchParams {
  month?: string;
}

export default async function ProductionCalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getLocale();
  const params = await searchParams;

  // Parse month from ?month=2026-02 format
  let year: number;
  let month: number;

  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [y, m] = params.month.split("-").map(Number);
    year = y;
    month = m;
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  let error: string | null = null;
  let orders: {
    id: number;
    invoice_id: string;
    invoice_number: string | null;
    customer_name: string | null;
    status: string;
    target_date: string;
  }[] = [];

  try {
    const result = await prisma.productionOrder.findMany({
      where: {
        target_date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        invoice: {
          select: { invoice_number: true, customer_name: true },
        },
      },
      orderBy: { target_date: "asc" },
    });

    orders = result
      .filter((o) => o.target_date)
      .map((o) => ({
        id: o.id,
        invoice_id: o.invoice_id,
        invoice_number: o.invoice?.invoice_number ?? null,
        customer_name: o.invoice?.customer_name ?? null,
        status: o.status,
        target_date: o.target_date!.toISOString().slice(0, 10),
      }));
  } catch (e) {
    error = e instanceof Error ? e.message : "DB connection failed";
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t(locale, "calendar.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t(locale, "calendar.orderCount", { count: orders.length })}
          </p>
        </div>
        <Link
          href="/production"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {t(locale, "calendar.backToDashboard")}
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <p className="font-semibold text-amber-800">{t(locale, "common.dbNotConnected")}</p>
          <p className="text-amber-700 mt-1">{error}</p>
        </div>
      )}

      <ProductionCalendar orders={orders} year={year} month={month} locale={locale} />
    </div>
  );
}
