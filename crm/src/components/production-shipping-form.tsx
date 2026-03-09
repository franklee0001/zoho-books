"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

const CARRIERS = ["DHL", "FedEx", "UPS", "EMS", "Other"];

interface ProductionShippingFormProps {
  orderId: number;
  invoiceId: string;
  shippingMethod: string | null;
  trackingNumber: string | null;
  currentStatus: string;
  locale: Locale;
}

export default function ProductionShippingForm({
  orderId,
  invoiceId,
  shippingMethod,
  trackingNumber,
  currentStatus,
  locale,
}: ProductionShippingFormProps) {
  const router = useRouter();
  const [carrier, setCarrier] = useState(shippingMethod ?? "");
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/production/${orderId}/shipping`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_method: carrier || null,
          tracking_number: tracking || null,
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

  async function handleWaybillUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("doc_type", "waybill");

      const res = await fetch(`/api/invoices/${invoiceId}/generate-documents`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Upload failed");
        return;
      }
      router.refresh();
    } catch {
      alert(t(locale, "status.networkError"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleMarkShipped() {
    const name = localStorage.getItem("production_changed_by") || prompt(t(locale, "status.enterName"));
    if (!name) return;
    localStorage.setItem("production_changed_by", name);

    setSaving(true);
    try {
      const res = await fetch(`/api/production/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "shipped", changed_by: name }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed");
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
          {t(locale, "production.shipping")}
        </h2>
      </div>
      <div className="px-6 py-4 space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            {t(locale, "production.shippingMethod")}
          </label>
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">—</option>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            {t(locale, "production.trackingNumber")}
          </label>
          <input
            type="text"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="1234567890"
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

        <hr className="border-gray-100" />

        {/* Waybill upload */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleWaybillUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {uploading ? t(locale, "docList.uploading") : t(locale, "production.waybillUpload")}
          </button>
        </div>

        {/* Mark shipped button - only show when packing */}
        {currentStatus === "packing" && (
          <button
            onClick={handleMarkShipped}
            disabled={saving}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {t(locale, "production.markShipped")}
          </button>
        )}
      </div>
    </div>
  );
}
