"use client";

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";

interface Attachment {
  id: number;
  filename: string;
  mime_type: string | null;
  size: number | null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewable(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf"
  );
}

function getFileIcon(mimeType: string | null): string {
  if (!mimeType) return "file";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "spreadsheet";
  if (mimeType.includes("document") || mimeType.includes("word")) return "doc";
  return "file";
}

export default function AttachmentList({
  attachments,
  locale,
}: {
  attachments: Attachment[];
  locale: Locale;
}) {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {attachments.map((att) => (
          <button
            key={att.id}
            onClick={() => {
              if (isPreviewable(att.mime_type)) {
                setPreviewAttachment(att);
              } else {
                window.open(`/api/gmail/attachments/${att.id}`, "_blank");
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs text-gray-700 transition-colors"
            title={att.filename}
          >
            <FileIcon type={getFileIcon(att.mime_type)} />
            <span className="max-w-[200px] truncate">{att.filename}</span>
            {att.size ? (
              <span className="text-gray-400 flex-shrink-0">
                ({formatFileSize(att.size)})
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Preview Modal */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3 min-w-0">
                <FileIcon type={getFileIcon(previewAttachment.mime_type)} />
                <span className="text-sm font-medium text-gray-900 truncate">
                  {previewAttachment.filename}
                </span>
                {previewAttachment.size ? (
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatFileSize(previewAttachment.size)}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={`/api/gmail/attachments/${previewAttachment.id}`}
                  download={previewAttachment.filename}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {t(locale, "common.download")}
                </a>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[300px]">
              {previewAttachment.mime_type?.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/gmail/attachments/${previewAttachment.id}`}
                  alt={previewAttachment.filename}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              ) : previewAttachment.mime_type === "application/pdf" ? (
                <iframe
                  src={`/api/gmail/attachments/${previewAttachment.id}`}
                  className="w-full h-[70vh] rounded-lg border border-gray-200"
                  title={previewAttachment.filename}
                />
              ) : (
                <div className="text-center text-gray-500">
                  <p className="text-sm">{t(locale, "attachment.noPreview")}</p>
                  <a
                    href={`/api/gmail/attachments/${previewAttachment.id}`}
                    download={previewAttachment.filename}
                    className="mt-3 inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                  >
                    {t(locale, "common.download")}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FileIcon({ type }: { type: string }) {
  const cls = "w-4 h-4 flex-shrink-0";
  switch (type) {
    case "image":
      return (
        <svg className={`${cls} text-green-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "pdf":
      return (
        <svg className={`${cls} text-red-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    default:
      return (
        <svg className={`${cls} text-gray-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      );
  }
}
