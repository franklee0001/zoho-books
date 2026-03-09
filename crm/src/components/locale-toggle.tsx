"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export default function LocaleToggle({ locale }: { locale: Locale }) {
  const router = useRouter();

  function toggle() {
    const next = locale === "ko" ? "en" : "ko";
    document.cookie = `locale=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      title={locale === "ko" ? "Switch to English" : "한국어로 전환"}
    >
      {locale === "ko" ? (
        <>
          <span className="text-sm">🇰🇷</span>
          <span>한국어</span>
        </>
      ) : (
        <>
          <span className="text-sm">🇺🇸</span>
          <span>EN</span>
        </>
      )}
    </button>
  );
}
