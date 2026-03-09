"use client";

import { useState, FormEvent } from "react";
import { t, type Locale } from "@/lib/i18n";

interface BusinessSettings {
  key: string;
  company_name: string | null;
  contact_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  dhl_account: string | null;
  incoterms: string | null;
  origin_country: string | null;
  packing_type: string | null;
  exporter_code: string | null;
  updated_at: Date | string;
}

const INCOTERMS_OPTIONS = ["EXW", "FOB", "CIF", "DAP", "DDP"];

export default function SettingsForm({
  settings,
  locale,
}: {
  settings: BusinessSettings;
  locale: Locale;
}) {
  const [form, setForm] = useState({
    company_name: settings.company_name ?? "",
    contact_name: settings.contact_name ?? "",
    address: settings.address ?? "",
    city: settings.city ?? "",
    state: settings.state ?? "",
    zipcode: settings.zipcode ?? "",
    country: settings.country ?? "",
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    dhl_account: settings.dhl_account ?? "",
    incoterms: settings.incoterms ?? "EXW",
    origin_country: settings.origin_country ?? "REPUBLIC OF KOREA",
    packing_type: settings.packing_type ?? "CARTON BOX",
    exporter_code: settings.exporter_code ?? "",
  });

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setToast({ type: "success", message: t(locale, "settings.saved") });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save",
      });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <form onSubmit={handleSubmit}>
      {/* Toast */}
      {toast && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
            toast.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
        {/* Company Name / Contact Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="company_name" className={labelClass}>
              {t(locale, "settings.companyName")}
            </label>
            <input
              id="company_name"
              type="text"
              value={form.company_name}
              onChange={(e) => update("company_name", e.target.value)}
              className={inputClass}
              placeholder={t(locale, "settings.placeholderCompany")}
            />
          </div>
          <div>
            <label htmlFor="contact_name" className={labelClass}>
              {t(locale, "settings.contactName")}
            </label>
            <input
              id="contact_name"
              type="text"
              value={form.contact_name}
              onChange={(e) => update("contact_name", e.target.value)}
              className={inputClass}
              placeholder={t(locale, "settings.placeholderContact")}
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address" className={labelClass}>
            {t(locale, "settings.address")}
          </label>
          <textarea
            id="address"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            rows={3}
            className={inputClass}
            placeholder={t(locale, "settings.placeholderAddress")}
          />
        </div>

        {/* City / State / Zipcode */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="city" className={labelClass}>
              {t(locale, "settings.city")}
            </label>
            <input
              id="city"
              type="text"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              className={inputClass}
              placeholder={t(locale, "settings.placeholderCity")}
            />
          </div>
          <div>
            <label htmlFor="state" className={labelClass}>
              {t(locale, "settings.state")}
            </label>
            <input
              id="state"
              type="text"
              value={form.state}
              onChange={(e) => update("state", e.target.value)}
              className={inputClass}
              placeholder={t(locale, "settings.placeholderState")}
            />
          </div>
          <div>
            <label htmlFor="zipcode" className={labelClass}>
              {t(locale, "settings.zipcode")}
            </label>
            <input
              id="zipcode"
              type="text"
              value={form.zipcode}
              onChange={(e) => update("zipcode", e.target.value)}
              className={inputClass}
              placeholder={t(locale, "settings.placeholderZipcode")}
            />
          </div>
        </div>

        {/* Country */}
        <div>
          <label htmlFor="country" className={labelClass}>
            {t(locale, "settings.country")}
          </label>
          <input
            id="country"
            type="text"
            value={form.country}
            onChange={(e) => update("country", e.target.value)}
            className={inputClass}
            placeholder={t(locale, "settings.placeholderCountry")}
          />
        </div>

        {/* Phone / Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className={labelClass}>
              {t(locale, "settings.phone")}
            </label>
            <input
              id="phone"
              type="text"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className={inputClass}
              placeholder={t(locale, "settings.placeholderPhone")}
            />
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>
              {t(locale, "settings.email")}
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className={inputClass}
              placeholder={t(locale, "settings.placeholderEmail")}
            />
          </div>
        </div>

        {/* DHL Account Number */}
        <div>
          <label htmlFor="dhl_account" className={labelClass}>
            {t(locale, "settings.dhlAccount")}
          </label>
          <input
            id="dhl_account"
            type="text"
            value={form.dhl_account}
            onChange={(e) => update("dhl_account", e.target.value)}
            className={inputClass}
            placeholder={t(locale, "settings.placeholderDhl")}
          />
        </div>

        {/* Incoterms */}
        <div>
          <label htmlFor="incoterms" className={labelClass}>
            {t(locale, "settings.incoterms")}
          </label>
          <select
            id="incoterms"
            value={form.incoterms}
            onChange={(e) => update("incoterms", e.target.value)}
            className={inputClass}
          >
            {INCOTERMS_OPTIONS.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </div>

        {/* Origin Country */}
        <div>
          <label htmlFor="origin_country" className={labelClass}>
            {t(locale, "settings.originCountry")}
          </label>
          <input
            id="origin_country"
            type="text"
            value={form.origin_country}
            onChange={(e) => update("origin_country", e.target.value)}
            className={inputClass}
            placeholder={t(locale, "settings.placeholderOrigin")}
          />
        </div>

        {/* Packing Type / Exporter Code */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="packing_type" className={labelClass}>
              {t(locale, "settings.packingType")}
            </label>
            <input
              id="packing_type"
              type="text"
              value={form.packing_type}
              onChange={(e) => update("packing_type", e.target.value)}
              className={inputClass}
              placeholder={t(locale, "settings.placeholderPacking")}
            />
          </div>
          <div>
            <label htmlFor="exporter_code" className={labelClass}>
              {t(locale, "settings.exporterCode")}
            </label>
            <input
              id="exporter_code"
              type="text"
              value={form.exporter_code}
              onChange={(e) => update("exporter_code", e.target.value)}
              className={inputClass}
              placeholder={t(locale, "settings.placeholderExporter")}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t(locale, "settings.saving") : t(locale, "settings.save")}
          </button>
        </div>
      </div>
    </form>
  );
}
