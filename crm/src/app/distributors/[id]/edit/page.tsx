import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import DistributorForm from "@/components/distributor-form";

export const dynamic = "force-dynamic";

export default async function EditDistributorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const distributorId = parseInt(id, 10);

  if (isNaN(distributorId)) notFound();

  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
  });

  if (!distributor) notFound();

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/distributors/${distributor.id}`}
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; {t(locale, "distributors.backToList")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {t(locale, "distributors.edit")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{distributor.company_name}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <DistributorForm
          locale={locale}
          mode="edit"
          initial={{
            id: distributor.id,
            company_name: distributor.company_name,
            contact_name: distributor.contact_name ?? "",
            email: distributor.email ?? "",
            country_code: distributor.country_code,
            country_name: distributor.country_name,
            product_scope: distributor.product_scope,
            products: distributor.products ?? "",
            stage: distributor.stage,
            notes: distributor.notes ?? "",
            customer_id: distributor.customer_id ?? "",
          }}
        />
      </div>
    </div>
  );
}
