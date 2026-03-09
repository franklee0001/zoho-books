"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/country-codes";
import { t, type Locale } from "@/lib/i18n";

const STAGES = [
  "lead",
  "contacted",
  "negotiating",
  "contract",
  "active",
  "inactive",
] as const;

interface CustomerOption {
  customer_id: string;
  customer_name: string | null;
  email: string | null;
  country: string | null;
}

interface DistributorData {
  id?: number;
  company_name: string;
  contact_name: string;
  email: string;
  country_code: string;
  country_name: string;
  product_scope: string;
  products: string;
  stage: string;
  notes: string;
  customer_id: string;
}

interface DistributorFormProps {
  locale: Locale;
  initial?: Partial<DistributorData>;
  mode: "create" | "edit";
}

export default function DistributorForm({ locale, initial, mode }: DistributorFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DistributorData>({
    company_name: initial?.company_name ?? "",
    contact_name: initial?.contact_name ?? "",
    email: initial?.email ?? "",
    country_code: initial?.country_code ?? "",
    country_name: initial?.country_name ?? "",
    product_scope: initial?.product_scope ?? "all",
    products: initial?.products ?? "",
    stage: initial?.stage ?? "lead",
    notes: initial?.notes ?? "",
    customer_id: initial?.customer_id ?? "",
  });

  // All customers (preloaded)
  const [allCustomers, setAllCustomers] = useState<CustomerOption[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>(
    initial?.customer_id ? "linked" : "",
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Country search filter
  const [countryFilter, setCountryFilter] = useState("");

  const filteredCountries = countryFilter
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(countryFilter.toLowerCase()) ||
          c.nameKo.includes(countryFilter) ||
          c.alpha2.toLowerCase().includes(countryFilter.toLowerCase()),
      )
    : COUNTRIES;

  // Preload all customers on mount
  useEffect(() => {
    fetch("/api/customers/search")
      .then((r) => r.ok ? r.json() : [])
      .then(setAllCustomers)
      .catch(() => {});
  }, []);

  // Client-side instant filtering
  const filteredCustomers = customerQuery.trim()
    ? allCustomers.filter((c) => {
        const q = customerQuery.toLowerCase();
        return (
          (c.customer_name?.toLowerCase().includes(q)) ||
          (c.email?.toLowerCase().includes(q)) ||
          (c.country?.toLowerCase().includes(q))
        );
      })
    : allCustomers;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCountryChange = (alpha2: string) => {
    const entry = COUNTRIES.find((c) => c.alpha2 === alpha2);
    setForm((f) => ({
      ...f,
      country_code: alpha2,
      country_name: entry?.name ?? "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url =
        mode === "edit"
          ? `/api/distributors/${initial?.id}`
          : "/api/distributors";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customer_id: form.customer_id || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/distributors/${data.id ?? initial?.id}`);
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Company Name */}
      <div>
        <label className={labelClass}>{t(locale, "distributors.companyName")} *</label>
        <input
          type="text"
          required
          value={form.company_name}
          onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
          className={inputClass}
        />
      </div>

      {/* Country */}
      <div>
        <label className={labelClass}>{t(locale, "distributors.country")} *</label>
        <input
          type="text"
          placeholder={t(locale, "distributors.selectCountry")}
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className={`${inputClass} mb-1`}
        />
        <select
          required
          value={form.country_code}
          onChange={(e) => handleCountryChange(e.target.value)}
          className={inputClass}
          size={countryFilter ? Math.min(filteredCountries.length, 8) : 1}
        >
          <option value="">{t(locale, "distributors.selectCountry")}</option>
          {filteredCountries.map((c) => (
            <option key={c.alpha2} value={c.alpha2}>
              {locale === "ko" ? `${c.nameKo} (${c.name})` : c.name} — {c.alpha2}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Contact Name */}
        <div>
          <label className={labelClass}>{t(locale, "distributors.contactName")}</label>
          <input
            type="text"
            value={form.contact_name}
            onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            className={inputClass}
          />
        </div>

        {/* Email */}
        <div>
          <label className={labelClass}>{t(locale, "distributors.email")}</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>

      {/* Product Scope */}
      <div>
        <label className={labelClass}>{t(locale, "distributors.productScope")}</label>
        <div className="flex gap-4 mt-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="product_scope"
              value="all"
              checked={form.product_scope === "all"}
              onChange={() => setForm((f) => ({ ...f, product_scope: "all", products: "" }))}
            />
            {t(locale, "distributors.allProducts")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="product_scope"
              value="specific"
              checked={form.product_scope === "specific"}
              onChange={() => setForm((f) => ({ ...f, product_scope: "specific" }))}
            />
            {t(locale, "distributors.specificProducts")}
          </label>
        </div>
        {form.product_scope === "specific" && (
          <input
            type="text"
            placeholder={t(locale, "distributors.productsPlaceholder")}
            value={form.products}
            onChange={(e) => setForm((f) => ({ ...f, products: e.target.value }))}
            className={`${inputClass} mt-2`}
          />
        )}
      </div>

      {/* Stage */}
      <div>
        <label className={labelClass}>{t(locale, "distributors.stage")}</label>
        <select
          value={form.stage}
          onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
          className={inputClass}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {t(locale, `stage.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>{t(locale, "distributors.notes")}</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className={inputClass}
        />
      </div>

      {/* Customer Link */}
      <div className="relative" ref={dropdownRef}>
        <label className={labelClass}>{t(locale, "distributors.linkedCustomer")}</label>
        {selectedCustomer && form.customer_id ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm font-medium text-blue-700 flex-1">{selectedCustomer}</span>
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, customer_id: "" }));
                setSelectedCustomer("");
                setCustomerQuery("");
              }}
              className="text-red-400 hover:text-red-600 text-lg leading-none"
            >
              &times;
            </button>
          </div>
        ) : (
          <input
            type="text"
            placeholder={t(locale, "distributors.selectCustomer")}
            value={customerQuery}
            onChange={(e) => {
              setCustomerQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className={inputClass}
          />
        )}
        {showDropdown && !form.customer_id && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            {filteredCustomers.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">
                {customerQuery
                  ? locale === "ko" ? "결과 없음" : "No results"
                  : locale === "ko" ? "고객 이름을 입력하세요" : "Type to search"}
              </div>
            ) : (
              filteredCustomers.map((c) => (
                <button
                  key={c.customer_id}
                  type="button"
                  className="w-full px-3 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0"
                  onClick={() => {
                    setForm((f) => ({ ...f, customer_id: c.customer_id }));
                    setSelectedCustomer(c.customer_name ?? c.customer_id);
                    setCustomerQuery("");
                    setShowDropdown(false);
                  }}
                >
                  <p className="text-sm font-medium text-gray-900">
                    {c.customer_name ?? c.customer_id}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {[c.email, c.country].filter(Boolean).join(" · ") || c.customer_id}
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? t(locale, "common.saving") : t(locale, "common.save")}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          {t(locale, "common.cancel")}
        </button>
      </div>
    </form>
  );
}
