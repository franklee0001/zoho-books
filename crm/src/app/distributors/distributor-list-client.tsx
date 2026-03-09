"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DistributorMap from "@/components/distributor-map";
import PipelineBadge from "@/components/pipeline-badge";
import { t, type Locale } from "@/lib/i18n";

const STAGES = ["all", "lead", "contacted", "negotiating", "contract", "active", "inactive"] as const;

interface DistributorRow {
  id: number;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  country_code: string;
  country_name: string;
  product_scope: string;
  products: string | null;
  stage: string;
  customer_name: string | null;
  customer_id: string | null;
  updated_at: string;
}

interface CountryAgg {
  country_code: string;
  country_name: string;
  count: number;
  hasActive: boolean;
}

interface Props {
  locale: Locale;
  distributors: DistributorRow[];
  countries: CountryAgg[];
}

export default function DistributorListClient({ locale, distributors, countries }: Props) {
  const router = useRouter();
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return distributors.filter((d) => {
      if (stageFilter !== "all" && d.stage !== stageFilter) return false;
      if (countryFilter && d.country_code !== countryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          d.company_name.toLowerCase().includes(q) ||
          d.country_name.toLowerCase().includes(q) ||
          (d.contact_name?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [distributors, stageFilter, countryFilter, search]);

  const handleDelete = async (id: number) => {
    if (!confirm(t(locale, "distributors.confirmDelete"))) return;
    await fetch(`/api/distributors/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const handleCountryClick = (code: string) => {
    setCountryFilter((prev) => (prev === code ? null : code));
  };

  return (
    <div className="space-y-6">
      {/* Map */}
      <DistributorMap
        countries={countries}
        locale={locale}
        onCountryClick={handleCountryClick}
        selectedCountry={countryFilter}
      />

      {countryFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Filtered: <strong>{countries.find((c) => c.country_code === countryFilter)?.country_name}</strong>
          </span>
          <button
            onClick={() => setCountryFilter(null)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Clear
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                stageFilter === s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "all" ? t(locale, "common.all") : t(locale, `stage.${s}`)}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder={t(locale, "distributors.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t(locale, "distributors.companyName")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t(locale, "distributors.country")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t(locale, "distributors.contactName")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t(locale, "distributors.stage")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t(locale, "distributors.productScope")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t(locale, "distributors.linkedCustomer")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  {t(locale, "distributors.updatedAt")}
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  {t(locale, "distributors.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    {distributors.length === 0
                      ? t(locale, "distributors.noDistributors")
                      : t(locale, "distributors.noMatch")}
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/distributors/${d.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {d.company_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {d.country_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {d.contact_name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <PipelineBadge stage={d.stage} locale={locale} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {d.product_scope === "all"
                        ? t(locale, "distributors.allProducts")
                        : d.products || t(locale, "distributors.specificProducts")}
                    </td>
                    <td className="px-4 py-3">
                      {d.customer_name ? (
                        <span className="text-blue-600">{d.customer_name}</span>
                      ) : (
                        <span className="text-gray-400">{t(locale, "distributors.noCustomer")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }).format(new Date(d.updated_at))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/distributors/${d.id}/edit`}
                          className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
                        >
                          {t(locale, "common.edit")}
                        </Link>
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                        >
                          {t(locale, "common.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
