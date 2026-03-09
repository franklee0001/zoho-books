import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";
import Link from "next/link";
import DistributorForm from "@/components/distributor-form";

export default async function NewDistributorPage() {
  const locale = await getLocale();

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/distributors"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; {t(locale, "distributors.backToList")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {t(locale, "distributors.addNew")}
        </h1>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <DistributorForm locale={locale} mode="create" />
      </div>
    </div>
  );
}
