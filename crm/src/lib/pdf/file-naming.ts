/**
 * 파일명 규칙: YYMMDD_CC_MODEL -QTYEA_type.pdf
 * 예: 260210_UK_HAP01 -7EA_pl.pdf
 */

interface FileNameInput {
  invoiceDate: Date | null;
  country: string | null;
  items: Array<{ sku: string | null; quantity: number | null }>;
  docType: "packing_list" | "commercial_invoice";
}

// 국가명 → 2글자 코드 매핑 (주요 거래국)
const COUNTRY_CODE: Record<string, string> = {
  "united kingdom": "UK",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  "republic of korea": "KR",
  "south korea": "KR",
  korea: "KR",
  japan: "JP",
  china: "CN",
  germany: "DE",
  france: "FR",
  canada: "CA",
  australia: "AU",
  italy: "IT",
  spain: "ES",
  netherlands: "NL",
  brazil: "BR",
  india: "IN",
  mexico: "MX",
  singapore: "SG",
  taiwan: "TW",
  "hong kong": "HK",
  thailand: "TH",
  vietnam: "VN",
  malaysia: "MY",
  indonesia: "ID",
  philippines: "PH",
  "new zealand": "NZ",
  sweden: "SE",
  switzerland: "CH",
  belgium: "BE",
  austria: "AT",
  denmark: "DK",
  norway: "NO",
  finland: "FI",
  portugal: "PT",
  poland: "PL",
  ireland: "IE",
  "czech republic": "CZ",
  russia: "RU",
  turkey: "TR",
  "saudi arabia": "SA",
  "united arab emirates": "AE",
  israel: "IL",
  "south africa": "ZA",
  egypt: "EG",
  colombia: "CO",
  chile: "CL",
  argentina: "AR",
  peru: "PE",
};

function toCountryCode(country: string | null): string {
  if (!country) return "XX";
  const lower = country.trim().toLowerCase();
  // 이미 2글자 코드면 그대로
  if (/^[a-z]{2}$/i.test(country.trim())) return country.trim().toUpperCase();
  return COUNTRY_CODE[lower] || country.trim().substring(0, 2).toUpperCase();
}

function formatDate(date: Date | null): string {
  if (!date) {
    const now = new Date();
    return (
      String(now.getFullYear() % 100).padStart(2, "0") +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0")
    );
  }
  const d = new Date(date);
  return (
    String(d.getFullYear() % 100).padStart(2, "0") +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
}

function sanitizeSku(str: string): string {
  // SKU는 공백 포함 허용, 파일시스템 위험 문자만 제거
  return str.replace(/[<>:"/\\|?*]/g, "").substring(0, 30);
}

function buildModelPart(
  items: Array<{ sku: string | null; quantity: number | null }>
): string {
  if (items.length === 0) return "NOITEM";

  const firstSku = items[0].sku ? sanitizeSku(items[0].sku) : "ITEM";
  const totalQty = Math.round(
    items.reduce((sum, item) => sum + (item.quantity || 0), 0)
  );

  return `${firstSku} -${totalQty}EA`;
}

const docTypeLabel: Record<string, string> = {
  packing_list: "pl",
  commercial_invoice: "ci",
};

export function generateFileName(input: FileNameInput): string {
  const datePart = formatDate(input.invoiceDate);
  const countryPart = toCountryCode(input.country);
  const modelPart = buildModelPart(input.items);
  const typePart = docTypeLabel[input.docType] || "doc";

  return `${datePart}_${countryPart}_${modelPart}_${typePart}.pdf`;
}

export function generateStoragePath(
  invoiceId: string,
  fileName: string
): string {
  return `invoices/${invoiceId}/${fileName}`;
}
