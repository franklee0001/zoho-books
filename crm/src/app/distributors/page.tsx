import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";
import Link from "next/link";
import StatsCard from "@/components/stats-card";
import DistributorListClient from "./distributor-list-client";

export const dynamic = "force-dynamic";

export default async function DistributorsPage() {
  const locale = await getLocale();
  let error: string | null = null;

  let distributors: Awaited<ReturnType<typeof prisma.distributor.findMany<{
    include: { customer: { select: { customer_id: true; customer_name: true } } };
  }>>> = [];

  let stats = { total: 0, active: 0, inDiscussion: 0, countries: 0 };

  try {
    distributors = await prisma.distributor.findMany({
      include: {
        customer: { select: { customer_id: true, customer_name: true } },
      },
      orderBy: { updated_at: "desc" },
    });

    const countrySet = new Set<string>();
    let active = 0;
    let inDiscussion = 0;

    for (const d of distributors) {
      countrySet.add(d.country_code);
      if (d.stage === "active") active++;
      if (["lead", "contacted", "negotiating", "contract"].includes(d.stage)) inDiscussion++;
    }

    stats = {
      total: distributors.length,
      active,
      inDiscussion,
      countries: countrySet.size,
    };
  } catch (e) {
    error = e instanceof Error ? e.message : "DB connection failed";
  }

  // Aggregate countries for map
  const countryAgg = new Map<string, { country_code: string; country_name: string; count: number; hasActive: boolean }>();
  for (const d of distributors) {
    const existing = countryAgg.get(d.country_code);
    if (existing) {
      existing.count++;
      if (d.stage === "active") existing.hasActive = true;
    } else {
      countryAgg.set(d.country_code, {
        country_code: d.country_code,
        country_name: d.country_name,
        count: 1,
        hasActive: d.stage === "active",
      });
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t(locale, "distributors.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t(locale, "distributors.subtitle")}</p>
        </div>
        <Link
          href="/distributors/new"
          className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + {t(locale, "distributors.addNew")}
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <p className="font-semibold text-amber-800">{t(locale, "common.dbNotConnected")}</p>
          <p className="text-amber-700 mt-1">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title={t(locale, "distributors.stats.total")} value={String(stats.total)} />
        <StatsCard title={t(locale, "distributors.stats.active")} value={String(stats.active)} trend="up" />
        <StatsCard title={t(locale, "distributors.stats.inDiscussion")} value={String(stats.inDiscussion)} trend="neutral" />
        <StatsCard title={t(locale, "distributors.stats.countries")} value={String(stats.countries)} />
      </div>

      {/* Client component with map + filters + table */}
      <DistributorListClient
        locale={locale}
        distributors={distributors.map((d) => ({
          id: d.id,
          company_name: d.company_name,
          contact_name: d.contact_name,
          email: d.email,
          country_code: d.country_code,
          country_name: d.country_name,
          product_scope: d.product_scope,
          products: d.products,
          stage: d.stage,
          customer_name: d.customer?.customer_name ?? null,
          customer_id: d.customer_id,
          updated_at: d.updated_at.toISOString(),
        }))}
        countries={Array.from(countryAgg.values())}
      />
    </div>
  );
}
