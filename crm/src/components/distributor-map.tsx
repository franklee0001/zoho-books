"use client";

import { useState, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { alpha2ToNumeric } from "@/lib/country-codes";
import { t, type Locale } from "@/lib/i18n";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

interface DistributorCountry {
  country_code: string;
  country_name: string;
  count: number;
  hasActive: boolean;
}

interface DistributorMapProps {
  countries: DistributorCountry[];
  locale: Locale;
  onCountryClick?: (countryCode: string) => void;
  selectedCountry?: string | null;
}

export default function DistributorMap({
  countries,
  locale,
  onCountryClick,
  selectedCountry,
}: DistributorMapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  const countryMap = useMemo(() => {
    const map = new Map<string, DistributorCountry>();
    for (const c of countries) {
      const numeric = alpha2ToNumeric(c.country_code);
      if (numeric) map.set(numeric, c);
    }
    return map;
  }, [countries]);

  return (
    <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <ComposableMap
        projectionConfig={{ scale: 147, center: [0, 20] }}
        className="w-full"
        style={{ maxHeight: 420 }}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const geoId = geo.id ?? "";
                const entry = countryMap.get(geoId);
                const isSelected =
                  selectedCountry &&
                  alpha2ToNumeric(selectedCountry) === geoId;

                let fill = "#E5E7EB";
                if (entry) {
                  fill = entry.hasActive ? "#3B82F6" : "#F59E0B";
                }
                if (isSelected) {
                  fill = entry?.hasActive ? "#1D4ED8" : "#D97706";
                }

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke="#FFF"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: {
                        fill: entry ? (entry.hasActive ? "#2563EB" : "#D97706") : "#D1D5DB",
                        outline: "none",
                        cursor: entry ? "pointer" : "default",
                      },
                      pressed: { outline: "none" },
                    }}
                    onMouseEnter={(evt) => {
                      if (entry) {
                        setTooltip({
                          x: evt.clientX,
                          y: evt.clientY,
                          content: t(locale, "distributors.mapTooltip", {
                            country: entry.country_name,
                            count: entry.count,
                          }),
                        });
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => {
                      if (entry && onCountryClick) {
                        onCountryClick(entry.country_code);
                      }
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-blue-500" />
          {t(locale, "stage.active")}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-amber-500" />
          In Discussion
        </span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 28 }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
