"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

interface ProductionScheduleFormProps {
  orderId: number;
  shippingDeadline: string | null;
  productionStartDate: string | null;
  productionEndDate: string | null;
  locale: Locale;
}

export default function ProductionScheduleForm({
  orderId,
  shippingDeadline,
  productionStartDate,
  productionEndDate,
  locale,
}: ProductionScheduleFormProps) {
  const router = useRouter();
  const [deadline, setDeadline] = useState(shippingDeadline ?? "");
  const [startDate, setStartDate] = useState(productionStartDate ?? "");
  const [endDate, setEndDate] = useState(productionEndDate ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/production/${orderId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_deadline: deadline || null,
          production_start_date: startDate || null,
          production_end_date: endDate || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save");
        return;
      }
      router.refresh();
    } catch {
      alert(t(locale, "status.networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          {t(locale, "production.schedule")}
        </h2>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            {t(locale, "production.shippingDeadline")}
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            {t(locale, "production.productionStart")}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            {t(locale, "production.productionEnd")}
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? t(locale, "common.saving") : t(locale, "common.save")}
        </button>
      </div>
    </div>
  );
}
