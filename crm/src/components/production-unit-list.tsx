"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

interface UnitData {
  id: number;
  category_slug: string;
  unit_index: number;
  serial_number: string | null;
  model_version: string | null;
  is_completed: boolean;
  line_item_name: string | null;
}

interface AccessoryItem {
  name: string | null;
  quantity: number;
}

interface ProductionUnitListProps {
  orderId: number;
  units: UnitData[];
  accessories: AccessoryItem[];
  locale: Locale;
}

export default function ProductionUnitList({
  orderId,
  units,
  accessories,
  locale,
}: ProductionUnitListProps) {
  const router = useRouter();
  const [localUnits, setLocalUnits] = useState(units);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const completedCount = localUnits.filter((u) => u.is_completed).length;
  const totalCount = localUnits.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function updateUnit(id: number, field: "serial_number" | "is_completed", value: string | boolean) {
    setLocalUnits((prev) =>
      prev.map((u) => (u.id === id ? { ...u, [field]: value } : u))
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/production/${orderId}/units`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          units: localUnits.map((u) => ({
            id: u.id,
            serial_number: u.serial_number,
            is_completed: u.is_completed,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      alert(t(locale, "status.networkError"));
    } finally {
      setSaving(false);
    }
  }

  // Group units by category
  const grouped: Record<string, UnitData[]> = {};
  for (const u of localUnits) {
    if (!grouped[u.category_slug]) grouped[u.category_slug] = [];
    grouped[u.category_slug].push(u);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {t(locale, "production.unitChecklist")}
          </h2>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-sm text-green-600">{t(locale, "production.unitsSaved")}</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? t(locale, "production.savingUnits") : t(locale, "production.saveUnits")}
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">
              {t(locale, "production.progress", { done: completedCount, total: totalCount })}
            </span>
            <span className="text-gray-500">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {Object.entries(grouped).map(([slug, catUnits]) => (
          <div key={slug} className="px-6 py-3">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              {t(locale, `category.${slug}`)}
            </h3>
            <div className="space-y-2">
              {catUnits.map((unit) => (
                <div key={unit.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={unit.is_completed}
                    onChange={(e) => updateUnit(unit.id, "is_completed", e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-sm min-w-[120px] ${unit.is_completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                    {unit.line_item_name ?? t(locale, `category.${slug}`)} #{unit.unit_index}
                    {unit.model_version && (
                      <span className="ml-1 text-xs text-gray-400">({unit.model_version})</span>
                    )}
                  </span>
                  <span className="text-xs text-gray-400">SN:</span>
                  <input
                    type="text"
                    value={unit.serial_number ?? ""}
                    onChange={(e) => updateUnit(unit.id, "serial_number", e.target.value)}
                    placeholder="________"
                    className="flex-1 max-w-[200px] px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {accessories.length > 0 && (
          <div className="px-6 py-3">
            <h3 className="text-sm font-medium text-gray-400 mb-1">
              {t(locale, "production.accessories")}
            </h3>
            <div className="text-sm text-gray-400">
              {accessories.map((a, i) => (
                <span key={i}>
                  {a.name ?? "Item"} x{a.quantity}
                  {i < accessories.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
