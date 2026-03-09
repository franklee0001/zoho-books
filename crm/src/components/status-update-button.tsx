"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

const STATUS_FLOW: Record<string, string> = {
  confirmed: "producing",
  producing: "checking",
  checking: "packing",
  packing: "shipped",
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  confirmed: "status.startProduction",
  producing: "status.markChecking",
  checking: "status.markPacking",
  packing: "status.markShipped",
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-600 hover:bg-blue-700",
  producing: "bg-cyan-600 hover:bg-cyan-700",
  checking: "bg-green-600 hover:bg-green-700",
  packing: "bg-purple-600 hover:bg-purple-700",
};

interface StatusUpdateButtonProps {
  orderId: number;
  currentStatus: string;
  compact?: boolean;
  locale: Locale;
}

export default function StatusUpdateButton({
  orderId,
  currentStatus,
  compact = false,
  locale,
}: StatusUpdateButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [changedBy, setChangedBy] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("production_changed_by");
    if (saved) setChangedBy(saved);
  }, []);

  const nextStatus = STATUS_FLOW[currentStatus];
  if (!nextStatus) return null;

  async function handleClick() {
    const name = changedBy.trim() || prompt(t(locale, "status.enterName"));
    if (!name) return;

    if (name !== changedBy) {
      setChangedBy(name);
      localStorage.setItem("production_changed_by", name);
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/production/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, changed_by: name }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update status");
        return;
      }

      router.refresh();
    } catch {
      alert(t(locale, "status.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${STATUS_COLORS[currentStatus] ?? "bg-gray-600 hover:bg-gray-700"} text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
      }`}
    >
      {loading ? t(locale, "status.updating") : t(locale, STATUS_LABEL_KEYS[currentStatus] ?? "status.confirmed")}
    </button>
  );
}
