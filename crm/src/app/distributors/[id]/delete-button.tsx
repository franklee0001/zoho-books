"use client";

import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

export default function DeleteButton({ id, locale }: { id: number; locale: Locale }) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(t(locale, "distributors.confirmDelete"))) return;
    const res = await fetch(`/api/distributors/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/distributors");
      router.refresh();
    }
  };

  return (
    <button
      onClick={handleDelete}
      className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
    >
      {t(locale, "common.delete")}
    </button>
  );
}
