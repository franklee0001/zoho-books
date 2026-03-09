import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";
import LeadsSyncButton from "./sync-button";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  country?: string;
  page?: string;
}

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ["all", "new", "In Progress", "Closed Won", "Closed Lost"];

const statusBadge: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  "In Progress": "bg-yellow-100 text-yellow-700",
  "Closed Won": "bg-green-100 text-green-700",
  "Closed Lost": "bg-gray-100 text-gray-600",
};

const chipBase =
  "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer";
const chipActive = "bg-blue-600 text-white";
const chipInactive = "bg-gray-100 text-gray-600 hover:bg-gray-200";

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return new Intl.DateTimeFormat("ko-KR").format(date);
}

function formatCurrency(val: unknown): string {
  if (val == null) return "—";
  const num = Number(val);
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

function buildHref(query: string, status: string, page: number, country?: string): string {
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  if (status !== "all") p.set("status", status);
  if (country && country !== "all") p.set("country", country);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return `/leads${qs ? `?${qs}` : ""}`;
}

function paginationRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const query = params.q ?? "";
  const statusFilter = params.status ?? "all";
  const countryFilter = params.country ?? "all";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { company: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { country: { contains: query, mode: "insensitive" } },
    ];
  }

  if (statusFilter !== "all") {
    where.deal_status = statusFilter;
  }

  if (countryFilter !== "all") {
    where.country = { equals: countryFilter, mode: "insensitive" };
  }

  let leads: Awaited<ReturnType<typeof prisma.lead.findMany>> = [];
  let total = 0;
  let statusCounts: Record<string, number> = {};
  let countryCounts: { country: string; count: number }[] = [];
  let error: string | null = null;

  try {
    const [leadResult, totalResult, groupResult, countryResult] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.lead.count({ where }),
      prisma.lead.groupBy({
        by: ["deal_status"],
        _count: { deal_status: true },
        ...(query
          ? {
              where: {
                OR: [
                  { name: { contains: query, mode: "insensitive" as const } },
                  { company: { contains: query, mode: "insensitive" as const } },
                  { email: { contains: query, mode: "insensitive" as const } },
                  { country: { contains: query, mode: "insensitive" as const } },
                ],
              },
            }
          : {}),
      }),
      prisma.$queryRaw<{ country: string; cnt: number }[]>`
        SELECT country, COUNT(*)::int AS cnt
        FROM leads
        WHERE country IS NOT NULL AND country != ''
        GROUP BY country
        ORDER BY cnt DESC
      `,
    ]);
    leads = leadResult;
    total = totalResult;

    countryCounts = countryResult.map((c) => ({ country: c.country, count: c.cnt }));

    let allCount = 0;
    for (const g of groupResult) {
      if (g.deal_status) {
        statusCounts[g.deal_status] = g._count.deal_status;
        allCount += g._count.deal_status;
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
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t(locale, "leads.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t(locale, "leads.subtitle", { count: total.toLocaleString() })}
          </p>
        </div>
        <LeadsSyncButton locale={locale} />
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
            placeholder={t(locale, "leads.searchPlaceholder")}
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

      {/* Filters Row */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {/* Status Chips */}
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => {
            const count = statusCounts[s] ?? 0;
            const isActive = statusFilter === s;
            const label = t(locale, `leads.status.${s}`);
            return (
              <a
                key={s}
                href={buildHref(query, s, 1, countryFilter)}
                className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
              >
                <span>{label}</span>
                <span className={`ml-1.5 text-xs ${isActive ? "text-blue-200" : "text-gray-400"}`}>
                  {count}
                </span>
            </a>
          );
        })}
        </div>

        {/* Country Filter */}
        <div className="flex items-center gap-2">
          {countryCounts.length > 0 && (
            <select
              defaultValue={countryFilter}
              className="country-filter px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">{t(locale, "leads.allCountries")} ({countryCounts.reduce((s, c) => s + c.count, 0)})</option>
              {countryCounts.map((c) => (
                <option key={c.country} value={c.country}>
                  {c.country} ({c.count})
                </option>
              ))}
            </select>
          )}
          <script
            dangerouslySetInnerHTML={{
              __html: `document.querySelector('.country-filter')?.addEventListener('change',function(e){var p=new URLSearchParams(window.location.search);var v=e.target.value;if(v==='all')p.delete('country');else p.set('country',v);p.delete('page');window.location.href='/leads'+(p.toString()?'?'+p.toString():'')})`,
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "leads.name")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "leads.company")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "leads.email")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "leads.country")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "leads.dealStatus")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "leads.source")}</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-600">{t(locale, "leads.amount")}</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">{t(locale, "leads.date")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="group hover:bg-blue-50/60 hover:shadow-[inset_0_0_0_1px_rgba(59,130,246,0.15)] transition-all duration-150 cursor-pointer">
                  <td className="px-6 py-4 font-medium text-blue-600 group-hover:text-blue-700">
                    <Link href={`/leads/${lead.id}`} className="group-hover:underline">{lead.name ?? "—"}</Link>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{lead.company ?? "—"}</td>
                  <td className="px-6 py-4 text-gray-500 group-hover:text-gray-700">{lead.email ?? "—"}</td>
                  <td className="px-6 py-4 text-gray-500">{lead.country ?? "—"}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        statusBadge[lead.deal_status ?? ""] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {lead.deal_status ?? "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{lead.source ?? "—"}</td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {formatCurrency(lead.amount)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(lead.date ?? lead.timestamp)}</td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    {error
                      ? t(locale, "common.dbNotConnected")
                      : query || statusFilter !== "all"
                        ? t(locale, "leads.noMatch")
                        : t(locale, "leads.noLeads")}
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
            {page > 1 ? (
              <a
                href={buildHref(query, statusFilter, page - 1, countryFilter)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                &lsaquo;
              </a>
            ) : (
              <span className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-300">
                &lsaquo;
              </span>
            )}
            {pages.map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 py-2 text-sm text-gray-400">
                  &hellip;
                </span>
              ) : (
                <a
                  key={p}
                  href={buildHref(query, statusFilter, p, countryFilter)}
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
            {page < totalPages ? (
              <a
                href={buildHref(query, statusFilter, page + 1, countryFilter)}
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
