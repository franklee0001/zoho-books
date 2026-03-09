"use client";

import { t, type Locale } from "@/lib/i18n";

interface LogEntry {
  id: number;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  note: string | null;
  changed_at: string;
}

interface ProductionTimelineProps {
  logs: LogEntry[];
  locale: Locale;
}

const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-yellow-500",
  producing: "bg-blue-500",
  checking: "bg-cyan-500",
  packing: "bg-green-500",
  shipped: "bg-purple-500",
  // Legacy
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function ProductionTimeline({ logs, locale }: ProductionTimelineProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          {t(locale, "production.timeline")}
        </h2>
      </div>
      <div className="px-6 py-4">
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            {t(locale, "production.noActivity")}
          </p>
        ) : (
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 relative">
                  <div
                    className={`w-6 h-6 rounded-full flex-shrink-0 z-10 flex items-center justify-center ${
                      STATUS_DOT[log.new_status] ?? "bg-gray-400"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{log.changed_by}</span>
                      <span className="text-xs text-gray-400">{formatDateTime(log.changed_at)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {log.old_status && (
                        <>
                          <span className="text-xs text-gray-500">
                            {t(locale, `status.${log.old_status}`)}
                          </span>
                          <span className="text-xs text-gray-400">&rarr;</span>
                        </>
                      )}
                      <span className="text-xs font-medium text-gray-700">
                        {t(locale, `status.${log.new_status}`)}
                      </span>
                    </div>
                    {log.note && (
                      <p className="text-xs text-gray-400 mt-0.5">{log.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
