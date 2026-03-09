import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ProductionBoard from "@/components/production-board";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ProductionBoardPage() {
  const locale = await getLocale();
  let error: string | null = null;
  let orders: {
    id: number;
    invoice_id: string;
    invoice_number: string | null;
    customer_name: string | null;
    status: string;
    priority: number;
    shipping_deadline: string | null;
    notes: string | null;
    lineItems: { name: string | null; quantity: number }[];
    unitProgress: { total: number; done: number };
  }[] = [];

  try {
    const result = await prisma.productionOrder.findMany({
      include: {
        invoice: {
          select: {
            invoice_number: true,
            customer_name: true,
            lineItems: {
              select: { name: true, quantity: true },
            },
          },
        },
        units: {
          select: { is_completed: true },
        },
      },
      orderBy: [{ priority: "desc" }, { created_at: "asc" }],
    });

    orders = result.map((o) => ({
      id: o.id,
      invoice_id: o.invoice_id,
      invoice_number: o.invoice?.invoice_number ?? null,
      customer_name: o.invoice?.customer_name ?? null,
      status: o.status,
      priority: o.priority,
      shipping_deadline: o.shipping_deadline ? o.shipping_deadline.toISOString().slice(0, 10) : null,
      notes: o.notes,
      lineItems: (o.invoice?.lineItems ?? []).map((li) => ({
        name: li.name,
        quantity: li.quantity ? Number(li.quantity) : 0,
      })),
      unitProgress: {
        total: o.units.length,
        done: o.units.filter((u) => u.is_completed).length,
      },
    }));
  } catch (e) {
    error = e instanceof Error ? e.message : "DB connection failed";
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t(locale, "board.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t(locale, "board.orderCount", { count: orders.length })}
          </p>
        </div>
        <Link
          href="/production"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {t(locale, "board.backToDashboard")}
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <p className="font-semibold text-amber-800">{t(locale, "common.dbNotConnected")}</p>
          <p className="text-amber-700 mt-1">{error}</p>
        </div>
      )}

      <ProductionBoard orders={orders} locale={locale} />
    </div>
  );
}
