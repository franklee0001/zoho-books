"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { t, type Locale } from "@/lib/i18n";

interface RagDocument {
  id: number;
  category: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: string;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
}

const CATEGORIES = ["email_template", "product_info", "company_status", "misc"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentPanel({ locale }: { locale: Locale }) {
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("misc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-chat/documents");
      if (res.ok) {
        setDocuments(await res.json());
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!["pdf", "docx", "txt"].includes(ext)) {
      alert(t(locale, "aiChat.invalidFileType"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert(t(locale, "aiChat.fileTooLarge"));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      const res = await fetch("/api/ai-chat/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Upload failed");
      }
      loadDocuments();
    } catch {
      alert(t(locale, "aiChat.errorMessage"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const deleteDocument = async (id: number) => {
    try {
      await fetch(`/api/ai-chat/documents/${id}`, { method: "DELETE" });
      loadDocuments();
    } catch {
      // ignore
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            {t(locale, "aiChat.ready")}
          </span>
        );
      case "processing":
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
            {t(locale, "aiChat.processing")}
          </span>
        );
      case "error":
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            {t(locale, "aiChat.error")}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">
          {t(locale, "aiChat.documents")}
        </h2>
      </div>

      {/* Upload */}
      <div className="p-4 border-b border-gray-100 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            {t(locale, "aiChat.category")}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {t(locale, `aiChat.category.${cat}`)}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          {uploading ? t(locale, "aiChat.uploading") : t(locale, "aiChat.uploadDocument")}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {documents.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">
            {t(locale, "aiChat.noDocuments")}
          </p>
        )}
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="group p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.file_name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {statusBadge(doc.status)}
                  <span className="text-xs text-gray-400">
                    {formatFileSize(doc.file_size)}
                  </span>
                  {doc.chunk_count > 0 && (
                    <span className="text-xs text-gray-400">
                      {t(locale, "aiChat.chunks", { count: doc.chunk_count })}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400 mt-0.5 block">
                  {t(locale, `aiChat.category.${doc.category}`)}
                </span>
              </div>
              <button
                onClick={() => deleteDocument(doc.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity flex-shrink-0"
                title={t(locale, "aiChat.deleteDocument")}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
