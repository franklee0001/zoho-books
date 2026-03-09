import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";
import { matchCategory } from "@/lib/product-categories";
import ProductionStageStepper from "@/components/production-stage-stepper";
import ProductionUnitList from "@/components/production-unit-list";
import ProductionScheduleForm from "@/components/production-schedule-form";
import ProductionShippingForm from "@/components/production-shipping-form";
import ProductionTimeline from "@/components/production-timeline";
import StatusUpdateButton from "@/components/status-update-button";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(d));
}

function getDDayLabel(deadline: Date | null | undefined): { text: string; className: string } | null {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { text: `D+${Math.abs(diff)}`, className: "text-red-600 bg-red-50" };
  if (diff === 0) return { text: "D-Day", className: "text-red-600 bg-red-50" };
  if (diff <= 3) return { text: `D-${diff}`, className: "text-orange-600 bg-orange-50" };
  return { text: `D-${diff}`, className: "text-gray-600 bg-gray-100" };
}

export default async function ProductionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (isNaN(orderId)) notFound();

  const locale = await getLocale();

  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      invoice: {
        select: {
          invoice_id: true,
          invoice_number: true,
          customer_name: true,
          lineItems: {
            select: {
              line_item_id: true,
              name: true,
              quantity: true,
            },
          },
        },
      },
      units: {
        orderBy: [{ category_slug: "asc" }, { unit_index: "asc" }],
      },
      statusLogs: {
        orderBy: { changed_at: "desc" },
        take: 30,
      },
    },
  });

  if (!order) notFound();

  // Build unit data for client component
  const unitNameMap: Record<string, string | null> = {};
  for (const li of order.invoice?.lineItems ?? []) {
    unitNameMap[li.line_item_id] = li.name;
  }

  const unitData = order.units.map((u) => ({
    id: u.id,
    category_slug: u.category_slug,
    unit_index: u.unit_index,
    serial_number: u.serial_number,
    model_version: u.model_version,
    is_completed: u.is_completed,
    line_item_name: unitNameMap[u.line_item_id] ?? null,
  }));

  // Build accessories list (line items without category match)
  const accessories = (order.invoice?.lineItems ?? [])
    .filter((li) => !li.name || !matchCategory(li.name))
    .map((li) => ({
      name: li.name,
      quantity: li.quantity ? Number(li.quantity) : 0,
    }));

  const dday = getDDayLabel(order.shipping_deadline);

  const timelineLogs = order.statusLogs.map((log) => ({
    id: log.id,
    old_status: log.old_status,
    new_status: log.new_status,
    changed_by: log.changed_by,
    note: log.note,
    changed_at: log.changed_at.toISOString(),
  }));

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/production"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; {t(locale, "production.backToList")}
        </Link>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {order.invoice?.customer_name ?? "—"}
                <span className="ml-3 text-base font-normal text-gray-500">
                  {order.invoice?.invoice_number ?? order.invoice_id}
                </span>
              </h1>
              {dday && (
                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-sm font-medium ${dday.className}`}>
                  {t(locale, "production.shippingDeadline")}: {formatDate(order.shipping_deadline)} ({dday.text})
                </span>
              )}
            </div>
            <StatusUpdateButton
              orderId={order.id}
              currentStatus={order.status}
              locale={locale}
            />
          </div>

          <ProductionStageStepper currentStatus={order.status} locale={locale} />
        </div>
      </div>

      {/* Body: 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: unit checklist (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <ProductionUnitList
            orderId={order.id}
            units={unitData}
            accessories={accessories}
            locale={locale}
          />
          <ProductionTimeline logs={timelineLogs} locale={locale} />
        </div>

        {/* Right: schedule + shipping (1/3) */}
        <div className="space-y-6">
          <ProductionScheduleForm
            orderId={order.id}
            shippingDeadline={order.shipping_deadline?.toISOString().slice(0, 10) ?? null}
            productionStartDate={order.production_start_date?.toISOString().slice(0, 10) ?? null}
            productionEndDate={order.production_end_date?.toISOString().slice(0, 10) ?? null}
            locale={locale}
          />
          <ProductionShippingForm
            orderId={order.id}
            invoiceId={order.invoice_id}
            shippingMethod={order.shipping_method}
            trackingNumber={order.tracking_number}
            currentStatus={order.status}
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
}
