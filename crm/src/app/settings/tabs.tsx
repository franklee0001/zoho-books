"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

export default function SettingsTabs({
  locale,
  isAdmin,
}: {
  locale: Locale;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  const tabs = [
    { href: "/settings", label: t(locale, "settings.title"), exact: true },
    ...(isAdmin
      ? [{ href: "/settings/users", label: t(locale, "admin.users"), exact: false }]
      : []),
  ];

  return (
    <div className="mb-6 border-b border-gray-200">
      <nav className="flex gap-6">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
