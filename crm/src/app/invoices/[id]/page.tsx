import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import PackingInfoForm from "@/components/packing-info-form";
import DocumentList from "@/components/document-list";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  sent: "bg-blue-100 text-blue-700",
  overdue: "bg-red-100 text-red-700",
  draft: "bg-gray-100 text-gray-600",
  void: "bg-yellow-100 text-yellow-700",
  partially_paid: "bg-orange-100 text-orange-700",
};

function formatCurrency(val: unknown): string {
  if (val == null) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(val));
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "\u2014";
  return new Intl.DateTimeFormat("ko-KR").format(new Date(d));
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();

  const invoice = await prisma.invoice.findUnique({
    where: { invoice_id: id },
    include: {
      customer: true,
      addresses: true,
      lineItems: {
        include: { packingInfo: true },
        orderBy: { created_at: "asc" },
      },
      packingInfo: true,
      generatedDocuments: {
        orderBy: { generated_at: "desc" },
      },
    },
  });

  if (!invoice) notFound();

  const billingAddress = invoice.addresses.find((a) => a.kind === "billing");
  const shippingAddress = invoice.addresses.find((a) => a.kind === "shipping");

  const lineItemsForForm = invoice.lineItems.map((li, idx) => ({
    line_item_id: li.line_item_id,
    name: li.name,
    description: li.description,
    sku: li.sku,
    quantity: li.quantity ? Number(li.quantity) : 0,
    rate: li.rate ? Number(li.rate) : 0,
    item_total: li.item_total ? Number(li.item_total) : 0,
    packingInfo: li.packingInfo
      ? {
          packing_no: li.packingInfo.packing_no ?? idx + 1,
          length_mm: li.packingInfo.length_mm
            ? Number(li.packingInfo.length_mm)
            : 0,
          width_mm: li.packingInfo.width_mm
            ? Number(li.packingInfo.width_mm)
            : 0,
          height_mm: li.packingInfo.height_mm
            ? Number(li.packingInfo.height_mm)
            : 0,
          package_type: li.packingInfo.package_type ?? "BOX",
          net_weight_kg: li.packingInfo.net_weight_kg
            ? Number(li.packingInfo.net_weight_kg)
            : 0,
          gross_weight_kg: li.packingInfo.gross_weight_kg
            ? Number(li.packingInfo.gross_weight_kg)
            : 0,
        }
      : null,
  }));

  const documentsForList = invoice.generatedDocuments.map((d) => ({
    id: d.id,
    invoice_id: d.invoice_id,
    doc_type: d.doc_type,
    file_name: d.file_name,
    storage_path: d.storage_path,
    file_size: d.file_size,
    generated_at: d.generated_at.toISOString(),
  }));

  return (
    <div>
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t(locale, "invoiceDetail.backToInvoices")}
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {invoice.invoice_number ?? t(locale, "common.noNumber")}
              </h1>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                  statusBadge[invoice.status ?? ""] ??
                  "bg-gray-100 text-gray-600"
                }`}
              >
                {invoice.status?.replace("_", " ") ?? "\u2014"}
              </span>
            </div>
            <p className="text-gray-600">
              {invoice.customer?.customer_name ?? t(locale, "invoiceDetail.unknownCustomer")}
            </p>
            {invoice.salesperson_name && (
              <p className="text-sm text-gray-400 mt-1">
                {t(locale, "invoiceDetail.salesperson", { name: invoice.salesperson_name })}
              </p>
            )}
          </div>
          <div className="text-right space-y-1">
            <p className="text-sm text-gray-500">
              {t(locale, "invoiceDetail.dateLabel", { date: formatDate(invoice.date) })}
            </p>
            <p className="text-sm text-gray-500">
              {t(locale, "invoiceDetail.dueLabel", { date: formatDate(invoice.due_date) })}
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {t(locale, "invoiceDetail.totalLabel", { amount: formatCurrency(invoice.total) })}
            </p>
            {Number(invoice.balance) > 0 && (
              <p className="text-sm text-orange-600">
                {t(locale, "invoiceDetail.balanceLabel", { amount: formatCurrency(invoice.balance) })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Addresses */}
      {(billingAddress || shippingAddress) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {billingAddress && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                {t(locale, "invoiceDetail.billingAddress")}
              </h2>
              <div className="text-sm text-gray-700 space-y-1">
                {billingAddress.attention && (
                  <p className="font-medium">{billingAddress.attention}</p>
                )}
                {billingAddress.address && <p>{billingAddress.address}</p>}
                {billingAddress.street2 && <p>{billingAddress.street2}</p>}
                <p>
                  {[
                    billingAddress.city,
                    billingAddress.state,
                    billingAddress.zipcode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {billingAddress.country && <p>{billingAddress.country}</p>}
                {billingAddress.phone && (
                  <p className="text-gray-500">Tel: {billingAddress.phone}</p>
                )}
              </div>
            </div>
          )}
          {shippingAddress && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                {t(locale, "invoiceDetail.shippingAddress")}
              </h2>
              <div className="text-sm text-gray-700 space-y-1">
                {shippingAddress.attention && (
                  <p className="font-medium">{shippingAddress.attention}</p>
                )}
                {shippingAddress.address && <p>{shippingAddress.address}</p>}
                {shippingAddress.street2 && <p>{shippingAddress.street2}</p>}
                <p>
                  {[
                    shippingAddress.city,
                    shippingAddress.state,
                    shippingAddress.zipcode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {shippingAddress.country && <p>{shippingAddress.country}</p>}
                {shippingAddress.phone && (
                  <p className="text-gray-500">Tel: {shippingAddress.phone}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Line Items + Packing Info Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {t(locale, "invoiceDetail.lineItems")}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  {t(locale, "invoiceDetail.packingNo")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  {t(locale, "invoiceDetail.description")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  {t(locale, "invoiceDetail.modelNo")}
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  {t(locale, "invoiceDetail.qty")}
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">
                  {t(locale, "invoiceDetail.size")}
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">
                  {t(locale, "invoiceDetail.pkg")}
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  {t(locale, "invoiceDetail.netWeight")}
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  {t(locale, "invoiceDetail.grossWeight")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.lineItems.map((li, idx) => {
                const pi = li.packingInfo;
                return (
                  <tr
                    key={li.line_item_id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-700">
                      {pi?.packing_no ?? idx + 1}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {li.name ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {li.sku ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {li.quantity ? Number(li.quantity) : 0}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {pi
                        ? `${Number(pi.length_mm) || 0} x ${Number(pi.width_mm) || 0} x ${Number(pi.height_mm) || 0}`
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {pi?.package_type ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {pi?.net_weight_kg ? Number(pi.net_weight_kg) : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {pi?.gross_weight_kg
                        ? Number(pi.gross_weight_kg)
                        : "\u2014"}
                    </td>
                  </tr>
                );
              })}
              {invoice.lineItems.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    {t(locale, "invoiceDetail.noLineItems")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Packing Info Form (only for paid invoices) */}
      {invoice.status === "paid" && (
        <div className="mb-6">
          <PackingInfoForm
            invoiceId={invoice.invoice_id}
            lineItems={lineItemsForForm}
            locale={locale}
          />
        </div>
      )}

      {/* Documents */}
      <DocumentList
        documents={documentsForList}
        invoiceId={invoice.invoice_id}
        locale={locale}
      />
    </div>
  );
}
