"use client";

import { t, type Locale } from "@/lib/i18n";

const STAGES = [
  { key: "confirmed", color: "bg-yellow-500" },
  { key: "producing", color: "bg-blue-500" },
  { key: "checking", color: "bg-cyan-500" },
  { key: "packing", color: "bg-green-500" },
  { key: "shipped", color: "bg-purple-500" },
] as const;

interface ProductionStageStepperProps {
  currentStatus: string;
  locale: Locale;
}

export default function ProductionStageStepper({
  currentStatus,
  locale,
}: ProductionStageStepperProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStatus);

  return (
    <div className="flex items-center w-full">
      {STAGES.map((stage, idx) => {
        const isActive = idx === currentIndex;
        const isPast = idx < currentIndex;
        const dotColor = isPast || isActive ? stage.color : "bg-gray-300";
        const lineColor = idx < currentIndex ? "bg-gray-400" : "bg-gray-200";

        return (
          <div key={stage.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${dotColor} ${
                  isActive ? "ring-4 ring-offset-2 ring-blue-200" : ""
                }`}
              >
                {isPast ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-white" : "bg-white/60"}`} />
                )}
              </div>
              <span
                className={`text-xs mt-1.5 whitespace-nowrap ${
                  isActive ? "font-bold text-gray-900" : isPast ? "text-gray-600" : "text-gray-400"
                }`}
              >
                {t(locale, `status.${stage.key}`)}
              </span>
            </div>
            {idx < STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mt-[-1rem] ${lineColor}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
