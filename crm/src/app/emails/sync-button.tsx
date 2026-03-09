"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

export default function EmailSyncButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      // 1. Sync emails
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPages: 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");

      let msg = `${data.saved} new, ${data.skipped} skipped`;

      // 2. Auto-index new attachments into RAG (fire & forget display, but await)
      try {
        const ragRes = await fetch("/api/gmail/attachments/index-rag", {
          method: "POST",
        });
        if (ragRes.ok) {
          const ragData = await ragRes.json();
          if (ragData.indexed > 0) {
            msg += ` · ${ragData.indexed} ${t(locale, "attachment.indexed")}`;
          }
        }
      } catch {
        // RAG indexing failure is non-critical
      }

      setResult(msg);
      if (data.saved > 0) router.refresh();
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
        {loading ? t(locale, "sync.syncing") : t(locale, "sync.syncEmails")}
      </button>
    </div>
  );
}
