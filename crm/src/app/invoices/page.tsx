import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
}

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ["all", "paid", "sent", "overdue", "draft", "void", "partially_paid"];

const statusBadge: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  sent: "bg-blue-100 text-blue-700",
  overdue: "bg-red-100 text-red-700",
  draft: "bg-gray-100 text-gray-600",
  void: "bg-yellow-100 text-yellow-700",
  partially_paid: "bg-orange-100 text-orange-700",
};

const chipBase =
  "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer";
const chipActive = "bg-blue-600 text-white";
const chipInactive = "bg-gray-100 text-gray-600 hover:bg-gray-200";

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

function buildHref(query: string, status: string, page: number): string {
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  if (status !== "all") p.set("status", status);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return `/invoices${qs ? `?${qs}` : ""}`;
}

function paginationRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [];
  pages.push(1);

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");

  pages.push(total);
  return pages;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const query = params.q ?? "";
  const statusFilter = params.status ?? "all";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const where: Record<string, unknown> = {};

  if (query) {
    where.OR = [
      { invoice_number: { contains: query, mode: "insensitive" } },
      { customer: { customer_name: { contains: query, mode: "insensitive" } } },
    ];
  }

  if (statusFilter !== "all") {
    where.status = statusFilter;
  }

  let invoices: Awaited<ReturnType<typeof prisma.invoice.findMany<{ include: { customer: true } }>>> = [];
  let total = 0;
  let statusCounts: Record<string, number> = {};
  let error: string | null = null;

  try {
    const [invoiceResult, totalResult, groupResult] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: PAGE_SIZE,
        include: { customer: true },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.groupBy({
        by: ["status"],
        _count: { status: true },
        ...(query
          ? {
              where: {
                OR: [
                  { invoice_number: { contains: query, mode: "insensitive" as const } },
                  { customer: { customer_name: { contains: query, mode: "insensitive" as const } } },
                ],
              },
            }
          : {}),
      }),
    ]);
    invoices = invoiceResult;
    total = totalResult;

    let allCount = 0;
    for (const g of groupResult) {
      if (g.status) {
        statusCounts[g.status] = g._count.status;
        allCount += g._count.status;
      }
    }
    statusCounts = { all: allCount, ...statusCounts };
  } catch (e) {
    error = e instanceof Error ? e.message : "DB connection failed";
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pages = paginationRange(page, totalPages);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t(locale, "invoices.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t(locale, "invoices.total", { count: total.toLocaleString() })}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <p className="font-semibold text-amber-800">{t(locale, "common.dbNotConnected")}</p>
          <p className="text-amber-700 mt-1">{t(locale, "common.dbNotConnectedDesc")}</p>
        </div>
      )}

      {/* Search */}
      <form method="GET" className="mb-4">
        <div className="flex gap-3">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder={t(locale, "invoices.searchPlaceholder")}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input type="hidden" name="status" value={statusFilter} />
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t(locale, "common.search")}
          </button>
        </div>
      </form>

      {/* Status Chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => {
          const count = statusCounts[s] ?? 0;
          const isActive = statusFilter === s;
          const label = t(locale, `invoiceStatus.${s}`);
          return (
            <a
              key={s}
              href={buildHref(query, s, 1)}
              className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
            >
              <span>{label}</span>
              <span
                className={`ml-1.5 text-xs ${isActive ? "text-blue-200" : "text-gray-400"}`}
              >
                {count}
              </span>
            </a>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "invoices.invoiceNo")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "invoices.customer")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "invoices.date")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "invoices.dueDate")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "invoices.status")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "invoices.salesperson")}</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-600">{t(locale, "invoices.total_amount")}</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-600">{t(locale, "invoices.balance")}</th>
                <th className="px-6 py-3 text-center font-semibold text-gray-600">{t(locale, "invoices.view")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.invoice_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-blue-600">
                    <Link href={`/invoices/${inv.invoice_id}`}>
                      {inv.invoice_number ?? "—"}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {inv.customer?.customer_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(inv.date)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(inv.due_date)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        statusBadge[inv.status ?? ""] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {inv.status?.replace("_", " ") ?? "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {inv.salesperson_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {formatCurrency(inv.total)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500">
                    {formatCurrency(inv.balance)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {inv.invoice_url ? (
                      <a
                        href={inv.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-800"
                        title="View invoice on Zoho"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                    {error
                      ? t(locale, "invoices.connectDb")
                      : query || statusFilter !== "all"
                        ? t(locale, "invoices.noMatch")
                        : t(locale, "invoices.noInvoices")}
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
          <div className="flex items-center gap-1">
            {/* Previous */}
            {page > 1 ? (
              <a
                href={buildHref(query, statusFilter, page - 1)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                &lsaquo;
              </a>
            ) : (
              <span className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-300">
                &lsaquo;
              </span>
            )}

            {/* Page Numbers */}
            {pages.map((p, i) =>
              p === "..." ? (
                <span
                  key={`ellipsis-${i}`}
                  className="px-2 py-2 text-sm text-gray-400"
                >
                  &hellip;
                </span>
              ) : (
                <a
                  key={p}
                  href={buildHref(query, statusFilter, p)}
                  className={`px-3 py-2 text-sm rounded-lg ${
                    p === page
                      ? "bg-blue-600 text-white font-medium"
                      : "border border-gray-300 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  {p}
                </a>
              ),
            )}

            {/* Next */}
            {page < totalPages ? (
              <a
                href={buildHref(query, statusFilter, page + 1)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                &rsaquo;
              </a>
            ) : (
              <span className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-300">
                &rsaquo;
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
