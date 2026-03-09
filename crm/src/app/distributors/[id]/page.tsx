import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import PipelineBadge from "@/components/pipeline-badge";
import DeleteButton from "./delete-button";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null | undefined, locale: string): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(d));
}

function formatCurrency(amount: unknown, currency: string | null): string {
  if (amount == null) return "—";
  const num = typeof amount === "object" && "toNumber" in (amount as Record<string, unknown>)
    ? (amount as { toNumber(): number }).toNumber()
    : Number(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(num);
}

export default async function DistributorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const distributorId = parseInt(id, 10);

  if (isNaN(distributorId)) notFound();

  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    include: {
      customer: {
        select: {
          customer_id: true,
          customer_name: true,
          email: true,
          invoices: {
            select: {
              invoice_id: true,
              invoice_number: true,
              date: true,
              status: true,
              total: true,
              currency_code: true,
              lineItems: {
                select: {
                  name: true,
                  quantity: true,
                  item_total: true,
                  rate: true,
                },
              },
            },
            orderBy: { date: "desc" },
          },
        },
      },
    },
  });

  if (!distributor) notFound();

  // Compute trade summary & product breakdown
  type ProductAgg = { name: string; qty: number; revenue: number; orders: number };
  const productMap = new Map<string, ProductAgg>();
  let totalRevenue = 0;
  let invoiceCount = 0;
  const currencySet = new Set<string>();

  if (distributor.customer) {
    for (const inv of distributor.customer.invoices) {
      invoiceCount++;
      const invTotal = Number(inv.total ?? 0);
      totalRevenue += invTotal;
      if (inv.currency_code) currencySet.add(inv.currency_code);

      for (const li of inv.lineItems) {
        const key = li.name || "Unknown";
        const existing = productMap.get(key);
        const qty = Number(li.quantity ?? 0);
        const revenue = Number(li.item_total ?? 0);
        if (existing) {
          existing.qty += qty;
          existing.revenue += revenue;
          existing.orders++;
        } else {
          productMap.set(key, { name: key, qty, revenue, orders: 1 });
        }
      }
    }
  }

  const products = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
  const mainCurrency = currencySet.size > 0 ? Array.from(currencySet)[0] : "USD";

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/distributors"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; {t(locale, "distributors.backToList")}
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{distributor.company_name}</h1>
            <p className="text-sm text-gray-500 mt-1">{distributor.country_name}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/distributors/${distributor.id}/edit`}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t(locale, "common.edit")}
            </Link>
            <DeleteButton id={distributor.id} locale={locale} />
          </div>
        </div>

        {/* Pipeline Stepper */}
        <div className="mb-6 py-4 border-y border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-3">{t(locale, "distributors.pipeline")}</p>
          <PipelineBadge stage={distributor.stage} locale={locale} mode="full" />
        </div>

        {/* Detail Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <DetailField label={t(locale, "distributors.contactName")} value={distributor.contact_name} />
            <DetailField label={t(locale, "distributors.email")} value={distributor.email} />
            <DetailField label={t(locale, "distributors.country")} value={`${distributor.country_name} (${distributor.country_code})`} />
            <DetailField
              label={t(locale, "distributors.productScope")}
              value={
                distributor.product_scope === "all"
                  ? t(locale, "distributors.allProducts")
                  : distributor.products || t(locale, "distributors.specificProducts")
              }
            />
          </div>
          <div className="space-y-4">
            <DetailField
              label={t(locale, "distributors.linkedCustomer")}
              value={distributor.customer?.customer_name ?? t(locale, "distributors.noCustomer")}
            />
            <DetailField label={t(locale, "distributors.createdAt")} value={formatDate(distributor.created_at, locale)} />
            <DetailField label={t(locale, "distributors.updatedAt")} value={formatDate(distributor.updated_at, locale)} />
            {distributor.notes && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">{t(locale, "distributors.notes")}</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{distributor.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trade Summary */}
      {distributor.customer && invoiceCount > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t(locale, "distributors.tradeSummary")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-xs font-medium text-gray-500">{t(locale, "distributors.totalRevenue")}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalRevenue, mainCurrency)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{t(locale, "distributors.invoiceCount")}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{invoiceCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{t(locale, "distributors.avgOrder")}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalRevenue / invoiceCount, mainCurrency)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{t(locale, "distributors.currency")}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{Array.from(currencySet).join(", ") || "—"}</p>
            </div>
          </div>

          {/* Product Breakdown */}
          {products.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t(locale, "distributors.productBreakdown")}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-2 font-medium text-gray-600">{t(locale, "distributors.productName")}</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">{t(locale, "distributors.totalQty")}</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">{t(locale, "distributors.totalAmount")}</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">{t(locale, "distributors.orderCount")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((p) => (
                      <tr key={p.name} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">{p.name}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{p.qty}</td>
                        <td className="px-4 py-2 text-right text-gray-900 font-medium">{formatCurrency(p.revenue, mainCurrency)}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{p.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {products.length === 0 && (
            <p className="text-sm text-gray-400">{t(locale, "distributors.noLineItems")}</p>
          )}
        </div>
      )}

      {/* Linked Invoices */}
      {distributor.customer && distributor.customer.invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {t(locale, "distributors.invoices")} ({distributor.customer.invoices.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {distributor.customer.invoices.map((inv) => (
                  <tr key={inv.invoice_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoices/${inv.invoice_id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {inv.invoice_number || inv.invoice_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(inv.date, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium">
                      {formatCurrency(inv.total, inv.currency_code)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {distributor.customer && distributor.customer.invoices.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center text-sm text-gray-400">
          {t(locale, "distributors.noInvoices")}
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value || "—"}</p>
    </div>
  );
}
