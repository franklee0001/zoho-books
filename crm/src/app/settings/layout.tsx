import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { getLocale } from "@/lib/get-locale";
import SettingsTabs from "./tabs";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const session = await getSession(await cookies());
  const isAdmin = session?.role === "admin";

  return (
    <div>
      <SettingsTabs locale={locale} isAdmin={isAdmin} />
      {children}
    </div>
  );
}
