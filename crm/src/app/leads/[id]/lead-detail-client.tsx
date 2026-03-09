"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";

interface LeadData {
  id: number;
  unique_key: string;
  timestamp: string | null;
  date: string | null;
  email: string | null;
  name: string | null;
  company: string | null;
  country: string | null;
  phone: string | null;
  website: string | null;
  source: string | null;
  product_interest: string | null;
  quantity: string | null;
  message: string | null;
  subject: string | null;
  reply_status: string | null;
  deal_status: string | null;
  order_status: string | null;
  amount: number | null;
  notes: string | null;
  distributor: string | null;
  extra_data: Record<string, string>;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

const DEAL_STATUS_OPTIONS = ["new", "In Progress", "Closed Won", "Closed Lost"];

export default function LeadDetailClient({
  lead,
  locale,
}: {
  lead: LeadData;
  locale: Locale;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [dealStatus, setDealStatus] = useState(lead.deal_status ?? "new");
  const [orderStatus, setOrderStatus] = useState(lead.order_status ?? "");
  const [amount, setAmount] = useState(lead.amount !== null ? String(lead.amount) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes || null,
          deal_status: dealStatus,
          order_status: orderStatus || null,
          amount: amount || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const readonlyFields = [
    { label: "UniqueKey", value: lead.unique_key },
    { label: t(locale, "leads.date"), value: lead.date || (lead.timestamp ? new Date(lead.timestamp).toLocaleDateString("ko-KR") : "—") },
    { label: t(locale, "leads.email"), value: lead.email },
    { label: t(locale, "leads.name"), value: lead.name },
    { label: t(locale, "leads.company"), value: lead.company },
    { label: t(locale, "leads.country"), value: lead.country },
    { label: t(locale, "leads.phone"), value: lead.phone },
    { label: t(locale, "leads.website"), value: lead.website },
    { label: t(locale, "leads.source"), value: lead.source },
    { label: t(locale, "leads.productInterest"), value: lead.product_interest },
    { label: t(locale, "leads.quantity"), value: lead.quantity },
    { label: t(locale, "leads.subject"), value: lead.subject },
    { label: t(locale, "leads.replyStatus"), value: lead.reply_status },
    { label: t(locale, "leads.distributor"), value: lead.distributor },
  ];

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/leads"
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t(locale, "leads.back")}
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {lead.name || lead.company || lead.email || "Lead"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{lead.unique_key}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Read-only Fields */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t(locale, "leads.readonlyFields")}
          </h2>
          <dl className="space-y-3">
            {readonlyFields.map(({ label, value }) => (
              <div key={label} className="flex">
                <dt className="w-36 flex-shrink-0 text-sm font-medium text-gray-500">{label}</dt>
                <dd className="text-sm text-gray-900 break-all">{value || "—"}</dd>
              </div>
            ))}
          </dl>

          {/* Message */}
          {lead.message && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">{t(locale, "leads.message")}</h3>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                {lead.message}
              </div>
            </div>
          )}

          {/* Extra Data */}
          {Object.keys(lead.extra_data).length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Extra Data</h3>
              <dl className="space-y-2">
                {Object.entries(lead.extra_data).map(([key, val]) => (
                  <div key={key} className="flex">
                    <dt className="w-36 flex-shrink-0 text-sm font-medium text-gray-400">{key}</dt>
                    <dd className="text-sm text-gray-700 break-all">{val}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {/* Editable Fields */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t(locale, "leads.editableFields")}
          </h2>

          <div className="space-y-5">
            {/* Deal Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t(locale, "leads.dealStatus")}
              </label>
              <select
                value={dealStatus}
                onChange={(e) => setDealStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DEAL_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(locale, `leads.status.${s}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t(locale, "leads.orderStatus")}
              </label>
              <input
                type="text"
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t(locale, "leads.amount")}
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t(locale, "leads.notes")}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
              />
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? t(locale, "leads.saving") : t(locale, "leads.save")}
              </button>
              {saved && (
                <span className="text-sm text-green-600 font-medium">
                  {t(locale, "leads.saved")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
