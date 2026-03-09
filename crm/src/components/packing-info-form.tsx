"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

interface PackingData {
  packing_no: number;
  length_mm: number;
  width_mm: number;
  height_mm: number;
  package_type: string;
  net_weight_kg: number;
  gross_weight_kg: number;
}

interface LineItemWithPacking {
  line_item_id: string;
  name: string | null;
  description: string | null;
  sku: string | null;
  quantity: number;
  rate: number;
  item_total: number;
  packingInfo: PackingData | null;
}

interface PackingInfoFormProps {
  invoiceId: string;
  lineItems: LineItemWithPacking[];
  locale: Locale;
}

type Status = "idle" | "saving" | "saved" | "generating" | "generated" | "error";

export default function PackingInfoForm({
  invoiceId,
  lineItems,
  locale,
}: PackingInfoFormProps) {
  const router = useRouter();

  const [rows, setRows] = useState<PackingData[]>(
    lineItems.map((li, idx) =>
      li.packingInfo
        ? { ...li.packingInfo }
        : {
            packing_no: idx + 1,
            length_mm: 0,
            width_mm: 0,
            height_mm: 0,
            package_type: "BOX",
            net_weight_kg: 0,
            gross_weight_kg: 0,
          }
    )
  );

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function updateRow(idx: number, field: keyof PackingData, value: string) {
    setRows((prev) => {
      const next = [...prev];
      if (field === "package_type") {
        next[idx] = { ...next[idx], [field]: value };
      } else {
        next[idx] = { ...next[idx], [field]: parseFloat(value) || 0 };
      }
      return next;
    });
    if (status === "saved" || status === "generated") setStatus("idle");
  }

  async function handleSave() {
    setStatus("saving");
    setErrorMsg("");

    try {
      const items = lineItems.map((li, idx) => ({
        line_item_id: li.line_item_id,
        ...rows[idx],
      }));

      const res = await fetch(`/api/invoices/${invoiceId}/packing-info`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }

      setStatus("saved");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleGenerate() {
    setStatus("generating");
    setErrorMsg("");

    try {
      const res = await fetch(
        `/api/invoices/${invoiceId}/generate-documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }

      setStatus("generated");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Generation failed");
    }
  }

  const inputClass =
    "w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t(locale, "packing.editTitle")}
        </h2>
        <div className="flex items-center gap-3">
          {status === "saved" && (
            <span className="text-sm text-green-600 font-medium">
              {t(locale, "packing.saved")}
            </span>
          )}
          {status === "generated" && (
            <span className="text-sm text-green-600 font-medium">
              {t(locale, "packing.docsGenerated")}
            </span>
          )}
          {status === "error" && (
            <span className="text-sm text-red-600 font-medium">
              {errorMsg}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={status === "saving" || status === "generating"}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "saving" ? t(locale, "packing.saving") : t(locale, "packing.save")}
          </button>
          <button
            onClick={handleGenerate}
            disabled={status === "saving" || status === "generating"}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "generating"
              ? t(locale, "packing.generating")
              : t(locale, "packing.generate")}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-600 w-20">
                PACKING NO
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                DESCRIPTION
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 w-28">
                MODEL NO
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 w-16">
                QTY
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600" colSpan={3}>
                SIZE (L &times; W &times; H mm)
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600 w-24">
                PKG
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 w-28">
                N.WEIGHT (KG)
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 w-28">
                G.WEIGHT (KG)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lineItems.map((li, idx) => (
              <tr key={li.line_item_id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={rows[idx].packing_no}
                    onChange={(e) =>
                      updateRow(idx, "packing_no", e.target.value)
                    }
                    className={inputClass}
                    min={1}
                  />
                </td>
                <td className="px-4 py-2 text-gray-700">
                  <div className="font-medium">{li.name ?? "\u2014"}</div>
                  {li.description && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                      {li.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                  {li.sku ?? "\u2014"}
                </td>
                <td className="px-4 py-2 text-right text-gray-700">
                  {li.quantity}
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    value={rows[idx].length_mm || ""}
                    onChange={(e) =>
                      updateRow(idx, "length_mm", e.target.value)
                    }
                    placeholder="L"
                    className={inputClass}
                    min={0}
                    step={0.01}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    value={rows[idx].width_mm || ""}
                    onChange={(e) =>
                      updateRow(idx, "width_mm", e.target.value)
                    }
                    placeholder="W"
                    className={inputClass}
                    min={0}
                    step={0.01}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    value={rows[idx].height_mm || ""}
                    onChange={(e) =>
                      updateRow(idx, "height_mm", e.target.value)
                    }
                    placeholder="H"
                    className={inputClass}
                    min={0}
                    step={0.01}
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={rows[idx].package_type}
                    onChange={(e) =>
                      updateRow(idx, "package_type", e.target.value)
                    }
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="BOX">BOX</option>
                    <option value="PALLET">PALLET</option>
                    <option value="CRATE">CRATE</option>
                    <option value="DRUM">DRUM</option>
                    <option value="BAG">BAG</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={rows[idx].net_weight_kg || ""}
                    onChange={(e) =>
                      updateRow(idx, "net_weight_kg", e.target.value)
                    }
                    placeholder="0.000"
                    className={inputClass}
                    min={0}
                    step={0.001}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={rows[idx].gross_weight_kg || ""}
                    onChange={(e) =>
                      updateRow(idx, "gross_weight_kg", e.target.value)
                    }
                    placeholder="0.000"
                    className={inputClass}
                    min={0}
                    step={0.001}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
