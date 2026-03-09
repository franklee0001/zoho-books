/**
 * ISO country code mappings.
 * world-atlas@2 TopoJSON uses ISO 3166-1 numeric `id` (e.g. "840" = USA).
 * We store alpha-2 in DB and map to numeric for the map component.
 */

export interface CountryEntry {
  alpha2: string;
  alpha3: string;
  numeric: string;
  name: string;
  nameKo: string;
}

export const COUNTRIES: CountryEntry[] = [
  { alpha2: "AF", alpha3: "AFG", numeric: "004", name: "Afghanistan", nameKo: "아프가니스탄" },
  { alpha2: "AL", alpha3: "ALB", numeric: "008", name: "Albania", nameKo: "알바니아" },
  { alpha2: "DZ", alpha3: "DZA", numeric: "012", name: "Algeria", nameKo: "알제리" },
  { alpha2: "AR", alpha3: "ARG", numeric: "032", name: "Argentina", nameKo: "아르헨티나" },
  { alpha2: "AM", alpha3: "ARM", numeric: "051", name: "Armenia", nameKo: "아르메니아" },
  { alpha2: "AU", alpha3: "AUS", numeric: "036", name: "Australia", nameKo: "호주" },
  { alpha2: "AT", alpha3: "AUT", numeric: "040", name: "Austria", nameKo: "오스트리아" },
  { alpha2: "AZ", alpha3: "AZE", numeric: "031", name: "Azerbaijan", nameKo: "아제르바이잔" },
  { alpha2: "BH", alpha3: "BHR", numeric: "048", name: "Bahrain", nameKo: "바레인" },
  { alpha2: "BD", alpha3: "BGD", numeric: "050", name: "Bangladesh", nameKo: "방글라데시" },
  { alpha2: "BY", alpha3: "BLR", numeric: "112", name: "Belarus", nameKo: "벨라루스" },
  { alpha2: "BE", alpha3: "BEL", numeric: "056", name: "Belgium", nameKo: "벨기에" },
  { alpha2: "BO", alpha3: "BOL", numeric: "068", name: "Bolivia", nameKo: "볼리비아" },
  { alpha2: "BA", alpha3: "BIH", numeric: "070", name: "Bosnia and Herzegovina", nameKo: "보스니아 헤르체고비나" },
  { alpha2: "BR", alpha3: "BRA", numeric: "076", name: "Brazil", nameKo: "브라질" },
  { alpha2: "BN", alpha3: "BRN", numeric: "096", name: "Brunei", nameKo: "브루나이" },
  { alpha2: "BG", alpha3: "BGR", numeric: "100", name: "Bulgaria", nameKo: "불가리아" },
  { alpha2: "KH", alpha3: "KHM", numeric: "116", name: "Cambodia", nameKo: "캄보디아" },
  { alpha2: "CM", alpha3: "CMR", numeric: "120", name: "Cameroon", nameKo: "카메룬" },
  { alpha2: "CA", alpha3: "CAN", numeric: "124", name: "Canada", nameKo: "캐나다" },
  { alpha2: "CL", alpha3: "CHL", numeric: "152", name: "Chile", nameKo: "칠레" },
  { alpha2: "CN", alpha3: "CHN", numeric: "156", name: "China", nameKo: "중국" },
  { alpha2: "CO", alpha3: "COL", numeric: "170", name: "Colombia", nameKo: "콜롬비아" },
  { alpha2: "CR", alpha3: "CRI", numeric: "188", name: "Costa Rica", nameKo: "코스타리카" },
  { alpha2: "HR", alpha3: "HRV", numeric: "191", name: "Croatia", nameKo: "크로아티아" },
  { alpha2: "CU", alpha3: "CUB", numeric: "192", name: "Cuba", nameKo: "쿠바" },
  { alpha2: "CY", alpha3: "CYP", numeric: "196", name: "Cyprus", nameKo: "키프로스" },
  { alpha2: "CZ", alpha3: "CZE", numeric: "203", name: "Czech Republic", nameKo: "체코" },
  { alpha2: "DK", alpha3: "DNK", numeric: "208", name: "Denmark", nameKo: "덴마크" },
  { alpha2: "DO", alpha3: "DOM", numeric: "214", name: "Dominican Republic", nameKo: "도미니카 공화국" },
  { alpha2: "EC", alpha3: "ECU", numeric: "218", name: "Ecuador", nameKo: "에콰도르" },
  { alpha2: "EG", alpha3: "EGY", numeric: "818", name: "Egypt", nameKo: "이집트" },
  { alpha2: "SV", alpha3: "SLV", numeric: "222", name: "El Salvador", nameKo: "엘살바도르" },
  { alpha2: "EE", alpha3: "EST", numeric: "233", name: "Estonia", nameKo: "에스토니아" },
  { alpha2: "ET", alpha3: "ETH", numeric: "231", name: "Ethiopia", nameKo: "에티오피아" },
  { alpha2: "FI", alpha3: "FIN", numeric: "246", name: "Finland", nameKo: "핀란드" },
  { alpha2: "FR", alpha3: "FRA", numeric: "250", name: "France", nameKo: "프랑스" },
  { alpha2: "GE", alpha3: "GEO", numeric: "268", name: "Georgia", nameKo: "조지아" },
  { alpha2: "DE", alpha3: "DEU", numeric: "276", name: "Germany", nameKo: "독일" },
  { alpha2: "GH", alpha3: "GHA", numeric: "288", name: "Ghana", nameKo: "가나" },
  { alpha2: "GR", alpha3: "GRC", numeric: "300", name: "Greece", nameKo: "그리스" },
  { alpha2: "GT", alpha3: "GTM", numeric: "320", name: "Guatemala", nameKo: "과테말라" },
  { alpha2: "HN", alpha3: "HND", numeric: "340", name: "Honduras", nameKo: "온두라스" },
  { alpha2: "HK", alpha3: "HKG", numeric: "344", name: "Hong Kong", nameKo: "홍콩" },
  { alpha2: "HU", alpha3: "HUN", numeric: "348", name: "Hungary", nameKo: "헝가리" },
  { alpha2: "IS", alpha3: "ISL", numeric: "352", name: "Iceland", nameKo: "아이슬란드" },
  { alpha2: "IN", alpha3: "IND", numeric: "356", name: "India", nameKo: "인도" },
  { alpha2: "ID", alpha3: "IDN", numeric: "360", name: "Indonesia", nameKo: "인도네시아" },
  { alpha2: "IR", alpha3: "IRN", numeric: "364", name: "Iran", nameKo: "이란" },
  { alpha2: "IQ", alpha3: "IRQ", numeric: "368", name: "Iraq", nameKo: "이라크" },
  { alpha2: "IE", alpha3: "IRL", numeric: "372", name: "Ireland", nameKo: "아일랜드" },
  { alpha2: "IL", alpha3: "ISR", numeric: "376", name: "Israel", nameKo: "이스라엘" },
  { alpha2: "IT", alpha3: "ITA", numeric: "380", name: "Italy", nameKo: "이탈리아" },
  { alpha2: "JM", alpha3: "JAM", numeric: "388", name: "Jamaica", nameKo: "자메이카" },
  { alpha2: "JP", alpha3: "JPN", numeric: "392", name: "Japan", nameKo: "일본" },
  { alpha2: "JO", alpha3: "JOR", numeric: "400", name: "Jordan", nameKo: "요르단" },
  { alpha2: "KZ", alpha3: "KAZ", numeric: "398", name: "Kazakhstan", nameKo: "카자흐스탄" },
  { alpha2: "KE", alpha3: "KEN", numeric: "404", name: "Kenya", nameKo: "케냐" },
  { alpha2: "KR", alpha3: "KOR", numeric: "410", name: "South Korea", nameKo: "대한민국" },
  { alpha2: "KW", alpha3: "KWT", numeric: "414", name: "Kuwait", nameKo: "쿠웨이트" },
  { alpha2: "LV", alpha3: "LVA", numeric: "428", name: "Latvia", nameKo: "라트비아" },
  { alpha2: "LB", alpha3: "LBN", numeric: "422", name: "Lebanon", nameKo: "레바논" },
  { alpha2: "LY", alpha3: "LBY", numeric: "434", name: "Libya", nameKo: "리비아" },
  { alpha2: "LT", alpha3: "LTU", numeric: "440", name: "Lithuania", nameKo: "리투아니아" },
  { alpha2: "LU", alpha3: "LUX", numeric: "442", name: "Luxembourg", nameKo: "룩셈부르크" },
  { alpha2: "MO", alpha3: "MAC", numeric: "446", name: "Macau", nameKo: "마카오" },
  { alpha2: "MY", alpha3: "MYS", numeric: "458", name: "Malaysia", nameKo: "말레이시아" },
  { alpha2: "MX", alpha3: "MEX", numeric: "484", name: "Mexico", nameKo: "멕시코" },
  { alpha2: "MA", alpha3: "MAR", numeric: "504", name: "Morocco", nameKo: "모로코" },
  { alpha2: "MM", alpha3: "MMR", numeric: "104", name: "Myanmar", nameKo: "미얀마" },
  { alpha2: "NP", alpha3: "NPL", numeric: "524", name: "Nepal", nameKo: "네팔" },
  { alpha2: "NL", alpha3: "NLD", numeric: "528", name: "Netherlands", nameKo: "네덜란드" },
  { alpha2: "NZ", alpha3: "NZL", numeric: "554", name: "New Zealand", nameKo: "뉴질랜드" },
  { alpha2: "NG", alpha3: "NGA", numeric: "566", name: "Nigeria", nameKo: "나이지리아" },
  { alpha2: "NO", alpha3: "NOR", numeric: "578", name: "Norway", nameKo: "노르웨이" },
  { alpha2: "OM", alpha3: "OMN", numeric: "512", name: "Oman", nameKo: "오만" },
  { alpha2: "PK", alpha3: "PAK", numeric: "586", name: "Pakistan", nameKo: "파키스탄" },
  { alpha2: "PA", alpha3: "PAN", numeric: "591", name: "Panama", nameKo: "파나마" },
  { alpha2: "PY", alpha3: "PRY", numeric: "600", name: "Paraguay", nameKo: "파라과이" },
  { alpha2: "PE", alpha3: "PER", numeric: "604", name: "Peru", nameKo: "페루" },
  { alpha2: "PH", alpha3: "PHL", numeric: "608", name: "Philippines", nameKo: "필리핀" },
  { alpha2: "PL", alpha3: "POL", numeric: "616", name: "Poland", nameKo: "폴란드" },
  { alpha2: "PT", alpha3: "PRT", numeric: "620", name: "Portugal", nameKo: "포르투갈" },
  { alpha2: "QA", alpha3: "QAT", numeric: "634", name: "Qatar", nameKo: "카타르" },
  { alpha2: "RO", alpha3: "ROU", numeric: "642", name: "Romania", nameKo: "루마니아" },
  { alpha2: "RU", alpha3: "RUS", numeric: "643", name: "Russia", nameKo: "러시아" },
  { alpha2: "SA", alpha3: "SAU", numeric: "682", name: "Saudi Arabia", nameKo: "사우디아라비아" },
  { alpha2: "RS", alpha3: "SRB", numeric: "688", name: "Serbia", nameKo: "세르비아" },
  { alpha2: "SG", alpha3: "SGP", numeric: "702", name: "Singapore", nameKo: "싱가포르" },
  { alpha2: "SK", alpha3: "SVK", numeric: "703", name: "Slovakia", nameKo: "슬로바키아" },
  { alpha2: "SI", alpha3: "SVN", numeric: "705", name: "Slovenia", nameKo: "슬로베니아" },
  { alpha2: "ZA", alpha3: "ZAF", numeric: "710", name: "South Africa", nameKo: "남아프리카공화국" },
  { alpha2: "ES", alpha3: "ESP", numeric: "724", name: "Spain", nameKo: "스페인" },
  { alpha2: "LK", alpha3: "LKA", numeric: "144", name: "Sri Lanka", nameKo: "스리랑카" },
  { alpha2: "SE", alpha3: "SWE", numeric: "752", name: "Sweden", nameKo: "스웨덴" },
  { alpha2: "CH", alpha3: "CHE", numeric: "756", name: "Switzerland", nameKo: "스위스" },
  { alpha2: "TW", alpha3: "TWN", numeric: "158", name: "Taiwan", nameKo: "대만" },
  { alpha2: "TH", alpha3: "THA", numeric: "764", name: "Thailand", nameKo: "태국" },
  { alpha2: "TN", alpha3: "TUN", numeric: "788", name: "Tunisia", nameKo: "튀니지" },
  { alpha2: "TR", alpha3: "TUR", numeric: "792", name: "Turkey", nameKo: "튀르키예" },
  { alpha2: "UA", alpha3: "UKR", numeric: "804", name: "Ukraine", nameKo: "우크라이나" },
  { alpha2: "AE", alpha3: "ARE", numeric: "784", name: "United Arab Emirates", nameKo: "아랍에미리트" },
  { alpha2: "GB", alpha3: "GBR", numeric: "826", name: "United Kingdom", nameKo: "영국" },
  { alpha2: "US", alpha3: "USA", numeric: "840", name: "United States", nameKo: "미국" },
  { alpha2: "UY", alpha3: "URY", numeric: "858", name: "Uruguay", nameKo: "우루과이" },
  { alpha2: "UZ", alpha3: "UZB", numeric: "860", name: "Uzbekistan", nameKo: "우즈베키스탄" },
  { alpha2: "VE", alpha3: "VEN", numeric: "862", name: "Venezuela", nameKo: "베네수엘라" },
  { alpha2: "VN", alpha3: "VNM", numeric: "704", name: "Vietnam", nameKo: "베트남" },
];

const alpha2ToNumericMap = new Map<string, string>();
const alpha2ToEntryMap = new Map<string, CountryEntry>();
for (const c of COUNTRIES) {
  alpha2ToNumericMap.set(c.alpha2, c.numeric);
  alpha2ToEntryMap.set(c.alpha2, c);
}

/** Convert alpha-2 to ISO numeric string (used by world-atlas TopoJSON) */
export function alpha2ToNumeric(code: string): string | undefined {
  return alpha2ToNumericMap.get(code.toUpperCase());
}

export function alpha2ToAlpha3(code: string): string | undefined {
  return alpha2ToEntryMap.get(code.toUpperCase())?.alpha3;
}

export function getCountryEntry(alpha2: string): CountryEntry | undefined {
  return alpha2ToEntryMap.get(alpha2.toUpperCase());
}
