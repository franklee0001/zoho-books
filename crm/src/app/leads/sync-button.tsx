"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

export default function LeadsSyncButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/leads/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setResult(
        t(locale, "leads.syncResult", {
          created: data.created,
          updated: data.updated,
          total: data.total,
        }),
      );
      if (data.created > 0 || data.updated > 0) router.refresh();
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-sm text-gray-600">{result}</span>}
      <button
        onClick={handleSync}
        disabled={loading}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? t(locale, "leads.syncing") : t(locale, "leads.sync")}
      </button>
    </div>
  );
}
