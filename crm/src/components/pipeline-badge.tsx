"use client";

import { t, type Locale } from "@/lib/i18n";

const STAGES = ["lead", "contacted", "negotiating", "contract", "active"] as const;

const STAGE_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  lead: { dot: "bg-gray-400", bg: "bg-gray-100", text: "text-gray-700" },
  contacted: { dot: "bg-blue-400", bg: "bg-blue-50", text: "text-blue-700" },
  negotiating: { dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700" },
  contract: { dot: "bg-purple-400", bg: "bg-purple-50", text: "text-purple-700" },
  active: { dot: "bg-green-500", bg: "bg-green-50", text: "text-green-700" },
  inactive: { dot: "bg-red-400", bg: "bg-red-50", text: "text-red-700" },
};

interface PipelineBadgeProps {
  stage: string;
  locale: Locale;
  mode?: "compact" | "full";
}

export default function PipelineBadge({ stage, locale, mode = "compact" }: PipelineBadgeProps) {
  const color = STAGE_COLORS[stage] ?? STAGE_COLORS.lead;

  if (mode === "compact") {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
        <span className={`w-2 h-2 rounded-full ${color.dot}`} />
        {t(locale, `stage.${stage}`)}
      </span>
    );
  }

  // Full pipeline stepper
  const isInactive = stage === "inactive";
  const currentIdx = STAGES.indexOf(stage as (typeof STAGES)[number]);

  return (
    <div className="flex items-center gap-0">
      {STAGES.map((s, idx) => {
        const isCurrent = s === stage;
        const isPast = !isInactive && currentIdx >= 0 && idx <= currentIdx;
        const stageColor = STAGE_COLORS[s];
        return (
          <div key={s} className="flex items-center">
            {idx > 0 && (
              <div
                className={`w-8 h-0.5 ${
                  isPast ? stageColor.dot : "bg-gray-200"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  isCurrent
                    ? `${stageColor.dot} border-current`
                    : isPast
                      ? `${stageColor.dot} border-transparent`
                      : "bg-white border-gray-300"
                }`}
              >
                {isCurrent && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <span
                className={`text-[10px] whitespace-nowrap ${
                  isCurrent ? "font-semibold text-gray-900" : "text-gray-400"
                }`}
              >
                {t(locale, `stage.${s}`)}
              </span>
            </div>
          </div>
        );
      })}

      {isInactive && (
        <div className="flex items-center ml-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            {t(locale, "stage.inactive")}
          </span>
        </div>
      )}
    </div>
  );
}
