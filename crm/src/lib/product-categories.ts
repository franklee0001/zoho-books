export interface ProductCategory {
  slug: string;
  nameKo: string;
  nameEn: string;
  keywords: string[];
}

// Order matters: hyperbaric must come before wbpbm (both match "chamber")
const CATEGORIES: ProductCategory[] = [
  {
    slug: "hydrogen",
    nameKo: "수소흡입기 (H-2000)",
    nameEn: "Hydrogen Inhaler (H-2000)",
    keywords: ["hydrogen", "h-2000", "h2000"],
  },
  {
    slug: "abdomen_pbm",
    nameKo: "복부 PBM",
    nameEn: "Abdomen PBM",
    keywords: ["abdomen pbm", "abdominal pbm"],
  },
  {
    slug: "breast_pbm",
    nameKo: "유방 PBM",
    nameEn: "Breast PBM",
    keywords: ["breast pbm"],
  },
  {
    slug: "hyperbaric",
    nameKo: "고압산소챔버",
    nameEn: "Hyperbaric Chamber",
    keywords: ["hyperbaric", "ro-101", "ro-070", "ro-120"],
  },
  {
    slug: "wbpbm",
    nameKo: "전신 PBM 챔버",
    nameEn: "Whole-Body PBM Chamber",
    keywords: ["wb pbm", "whole body pbm", "whole-body pbm", "chamber", "wbpbm"],
  },
  {
    slug: "pbm_wing",
    nameKo: "PBM 윙패널",
    nameEn: "PBM Wing Panel",
    keywords: ["pbm-wing", "wing panel", "pbm pannel"],
  },
  {
    slug: "wavemotion",
    nameKo: "웨이브모션",
    nameEn: "Wave Motion",
    keywords: ["wave motion", "sonicwave", "vm-15"],
  },
  {
    slug: "nanospa",
    nameKo: "나노스파",
    nameEn: "Nano Spa",
    keywords: ["nanobubble", "nano spa", "spa500"],
  },
  {
    slug: "sed",
    nameKo: "스페이스 에너지",
    nameEn: "Space Energy Device",
    keywords: ["space energy", "sed"],
  },
];

export function matchCategory(name: string): ProductCategory | null {
  const lower = name.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((kw) => lower.includes(kw))) {
      return cat;
    }
  }
  return null;
}

export function extractModelVersion(
  name: string,
  category: ProductCategory,
): string | null {
  const lower = name.toLowerCase();

  // Common model patterns: WB-PBM-03, RO-101, H-2000, VM-15, SPA500
  const modelPatterns = [
    /\b(wb-pbm-\d+)/i,
    /\b(ro-\d+)/i,
    /\b(h-?\d{3,})/i,
    /\b(vm-\d+)/i,
    /\b(spa\d+)/i,
  ];

  for (const pattern of modelPatterns) {
    const match = lower.match(pattern);
    if (match) return match[1].toUpperCase();
  }

  // Fallback: use category slug as identifier
  return null;
}

export function getCategoryBySlug(slug: string): ProductCategory | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getAllCategories(): ProductCategory[] {
  return CATEGORIES;
}
