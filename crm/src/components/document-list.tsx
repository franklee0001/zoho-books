"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

interface GeneratedDocument {
  id: number;
  invoice_id: string;
  doc_type: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  generated_at: string;
}

interface DocumentListProps {
  documents: GeneratedDocument[];
  invoiceId: string;
  locale: Locale;
}

const DOC_SLOTS = [
  { type: "commercial_invoice", labelKey: "docList.commercialInvoice", uploadable: false, replaceLabelKey: "" },
  { type: "packing_list", labelKey: "docList.packingList", uploadable: true, replaceLabelKey: "docList.replacePL" },
  { type: "waybill", labelKey: "docList.waybill", uploadable: true, replaceLabelKey: "docList.replace" },
] as const;

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "w-5 h-5 text-blue-600"}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}

function DocumentSlot({
  doc,
  slot,
  invoiceId,
  onUploaded,
  locale,
}: {
  doc: GeneratedDocument | undefined;
  slot: (typeof DOC_SLOTS)[number];
  invoiceId: string;
  onUploaded: () => void;
  locale: Locale;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("doc_type", slot.type);

      const res = await fetch(
        `/api/invoices/${invoiceId}/upload-document`,
        { method: "POST", body: form }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const slotColor = doc
    ? "border-gray-200"
    : "border-dashed border-gray-300";

  return (
    <div className={`rounded-lg border ${slotColor} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">{t(locale, slot.labelKey)}</h3>
      </div>

      {doc ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <DocIcon className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-900 truncate">{doc.file_name}</p>
              <p className="text-xs text-gray-400">
                {formatFileSize(doc.file_size)} &middot; {formatDateTime(doc.generated_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <a
              href={`/api/documents/${doc.id}/download`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <DownloadIcon />
              {t(locale, "docList.download")}
            </a>
            {slot.uploadable && (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <UploadIcon />
                  {uploading ? t(locale, "docList.uploading") : t(locale, slot.replaceLabelKey)}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">{t(locale, "docList.noFile")}</p>
          {slot.uploadable && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                <UploadIcon />
                {uploading ? t(locale, "docList.uploading") : t(locale, "docList.upload", { label: t(locale, slot.labelKey) })}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

export default function DocumentList({
  documents,
  invoiceId,
  locale,
}: DocumentListProps) {
  const router = useRouter();
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  const docMap = new Map<string, GeneratedDocument>();
  for (const doc of documents) {
    docMap.set(doc.doc_type, doc);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError("");

    try {
      const res = await fetch(
        `/api/invoices/${invoiceId}/generate-documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Regeneration failed");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t(locale, "docList.title")}</h2>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {regenerating ? t(locale, "docList.regenerating") : t(locale, "docList.regenerate")}
        </button>
      </div>

      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-100">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="p-6 space-y-3">
        {DOC_SLOTS.map((slot) => (
          <DocumentSlot
            key={slot.type}
            doc={docMap.get(slot.type)}
            slot={slot}
            invoiceId={invoiceId}
            onUploaded={() => router.refresh()}
            locale={locale}
          />
        ))}
      </div>
    </div>
  );
}
