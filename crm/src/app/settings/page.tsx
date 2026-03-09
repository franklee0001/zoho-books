import { prisma } from "@/lib/prisma";
import SettingsForm from "@/components/settings-form";
import { getLocale } from "@/lib/get-locale";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const locale = await getLocale();
  const raw = await prisma.businessSettings.upsert({
    where: { key: "default" },
    update: {},
    create: { key: "default" },
  });

  // Date → string 직렬화 (클라이언트 컴포넌트에 Date 전달 불가)
  const settings = { ...raw, updated_at: raw.updated_at.toISOString() };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t(locale, "settings.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t(locale, "settings.subtitle")}
        </p>
      </div>
      <SettingsForm settings={settings} locale={locale} />
    </div>
  );
}
