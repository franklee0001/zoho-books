import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  doc_type?: string;
  page?: string;
}

const PAGE_SIZE = 20;

const DOC_TYPE_OPTIONS = ["all", "packing_list", "commercial_invoice", "waybill"];

const docTypeLabel: Record<string, string> = {
  packing_list: "Packing List",
  commercial_invoice: "Commercial Invoice",
  waybill: "Waybill",
};

const docTypeBadge: Record<string, string> = {
  packing_list: "bg-purple-100 text-purple-700",
  commercial_invoice: "bg-teal-100 text-teal-700",
  waybill: "bg-amber-100 text-amber-700",
};

const chipBase =
  "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer";
const chipActive = "bg-blue-600 text-white";
const chipInactive = "bg-gray-100 text-gray-600 hover:bg-gray-200";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildHref(query: string, docType: string, page: number): string {
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  if (docType !== "all") p.set("doc_type", docType);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return `/documents${qs ? `?${qs}` : ""}`;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const docTypeFilter = params.doc_type ?? "all";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const where: Record<string, unknown> = {};

  if (query) {
    where.OR = [
      { file_name: { contains: query, mode: "insensitive" } },
      { invoice: { invoice_number: { contains: query, mode: "insensitive" } } },
    ];
  }

  if (docTypeFilter !== "all") {
    where.doc_type = docTypeFilter;
  }

  let documents: Awaited<ReturnType<typeof prisma.generatedDocument.findMany>> = [];
  let total = 0;
  let error: string | null = null;

  try {
    [documents, total] = await Promise.all([
      prisma.generatedDocument.findMany({
        where,
        orderBy: { generated_at: "desc" },
        skip,
        take: PAGE_SIZE,
        include: {
          invoice: {
            include: { customer: true },
          },
        },
      }),
      prisma.generatedDocument.count({ where }),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "DB connection failed";
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500 mt-1">
          CI, Packing List & Waybill — {total.toLocaleString()} documents
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <p className="font-semibold text-amber-800">Database error</p>
          <p className="text-amber-700 mt-1">{error}</p>
        </div>
      )}

      {/* Search */}
      <form method="GET" className="mb-4">
        <div className="flex gap-3">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search by file name or invoice #..."
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input type="hidden" name="doc_type" value={docTypeFilter} />
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Type Chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        {DOC_TYPE_OPTIONS.map((t) => {
          const isActive = docTypeFilter === t;
          const label = t === "all" ? "All" : docTypeLabel[t] ?? t;
          return (
            <a
              key={t}
              href={buildHref(query, t, 1)}
              className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
            >
              <span>{label}</span>
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
                <th className="px-6 py-3 text-left font-semibold text-gray-600">File Name</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">Type</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">Invoice</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">Customer</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-600">Generated</th>
                <th className="px-6 py-3 text-right font-semibold text-gray-600">Size</th>
                <th className="px-6 py-3 text-center font-semibold text-gray-600">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((doc) => {
                const inv = (doc as Record<string, unknown>).invoice as Record<string, unknown> | null;
                const customer = inv?.customer as Record<string, unknown> | null;
                return (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {doc.file_name}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          docTypeBadge[doc.doc_type] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {docTypeLabel[doc.doc_type] ?? doc.doc_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/invoices/${doc.invoice_id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {(inv?.invoice_number as string) ?? doc.invoice_id}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {(customer?.customer_name as string) ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatDate(doc.generated_at)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {formatFileSize(doc.file_size)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <a
                        href={`/api/documents/${doc.id}/download`}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download
                      </a>
                    </td>
                  </tr>
                );
              })}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    {error
                      ? "Connect database to see documents."
                      : "No documents found. Generate PL/CI from invoice detail pages."}
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
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            {page > 1 ? (
              <a
                href={buildHref(query, docTypeFilter, page - 1)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                &lsaquo;
              </a>
            ) : (
              <span className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-300">
                &lsaquo;
              </span>
            )}
            {page < totalPages ? (
              <a
                href={buildHref(query, docTypeFilter, page + 1)}
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
