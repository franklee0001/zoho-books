import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  page?: string;
}

const PAGE_SIZE = 20;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const query = params.q ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const where = query
    ? {
        OR: [
          { customer_name: { contains: query, mode: "insensitive" as const } },
          { company_name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  let customers: Awaited<ReturnType<typeof prisma.customer.findMany<{ include: { _count: { select: { invoices: true } } } }>>> = [];
  let total = 0;
  let error: string | null = null;

  try {
    [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { customer_name: "asc" },
        skip,
        take: PAGE_SIZE,
        include: { _count: { select: { invoices: true } } },
      }),
      prisma.customer.count({ where }),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "DB connection failed";
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t(locale, "customers.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t(locale, "customers.total", { count: total.toLocaleString() })}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <p className="font-semibold text-amber-800">{t(locale, "common.dbNotConnected")}</p>
          <p className="text-amber-700 mt-1">{t(locale, "common.dbNotConnectedDesc")}</p>
        </div>
      )}

      {/* Search */}
      <form method="GET" className="mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder={t(locale, "customers.searchPlaceholder")}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t(locale, "common.search")}
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "customers.name")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "customers.company")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "customers.email")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "customers.phone")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "customers.country")}</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-600">{t(locale, "customers.invoices")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c) => (
                <tr key={c.customer_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {c.customer_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-gray-700">{c.company_name ?? "—"}</td>
                  <td className="px-6 py-4 text-gray-500">{c.email ?? "—"}</td>
                  <td className="px-6 py-4 text-gray-500">{c.phone ?? "—"}</td>
                  <td className="px-6 py-4 text-gray-500">{c.country ?? "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      {c._count.invoices}
                    </span>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    {error
                      ? t(locale, "customers.connectDb")
                      : query
                        ? t(locale, "customers.noMatch", { query })
                        : t(locale, "customers.noCustomers")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500">
            {t(locale, "common.page", { page, total: totalPages })}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/customers?q=${encodeURIComponent(query)}&page=${page - 1}`}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t(locale, "common.previous")}
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/customers?q=${encodeURIComponent(query)}&page=${page + 1}`}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t(locale, "common.next")}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
