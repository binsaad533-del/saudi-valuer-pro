/**
 * المستوى 21 — التعرّف الذكي على المعدات
 * تحليل صور المعدات، قراءة لوحة البيانات، التصنيف التلقائي
 */

export interface EquipmentIdentification {
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  category: string;
  subcategory: string | null;
  estimatedAge: number | null;
  condition: string | null;
  specifications: Record<string, string>;
}

// Equipment category classification based on keywords
const EQUIPMENT_CATEGORIES: Record<string, { ar: string; subcategories: string[] }> = {
  heavy_machinery: {
    ar: "معدات ثقيلة",
    subcategories: ["حفار", "رافعة", "جرافة", "لودر", "بلدوزر", "كرين", "بوكلين"],
  },
  light_machinery: {
    ar: "معدات خفيفة",
    subcategories: ["رافعة شوكية", "وينش", "عربة نقل", "منصة رفع"],
  },
  electrical: {
    ar: "أنظمة كهربائية",
    subcategories: ["محول", "مولد", "لوحة توزيع", "UPS", "موزع", "كابل"],
  },
  mechanical: {
    ar: "أنظمة ميكانيكية",
    subcategories: ["مضخة", "ضاغط", "صمام", "مبادل حراري", "مروحة", "تكييف"],
  },
  production: {
    ar: "معدات إنتاج",
    subcategories: ["مخرطة", "فرز", "CNC", "ليزر", "لحام", "قص", "تعبئة", "تغليف"],
  },
  vehicles: {
    ar: "مركبات",
    subcategories: ["شاحنة", "سيارة", "باص", "جرار", "تريلا", "ناقلة"],
  },
  it_equipment: {
    ar: "تقنية معلومات",
    subcategories: ["حاسب", "خادم", "سيرفر", "طابعة", "شاشة", "راوتر", "سويتش"],
  },
  medical: {
    ar: "معدات طبية",
    subcategories: ["أشعة", "تصوير", "تخدير", "أسنان", "مختبر", "تعقيم"],
  },
  furniture: {
    ar: "أثاث ومفروشات",
    subcategories: ["مكتب", "كرسي", "خزانة", "طاولة", "رف", "ستائر"],
  },
};

export function classifyEquipment(name: string, description?: string): EquipmentIdentification {
  const text = `${name} ${description || ""}`.toLowerCase();
  
  let category = "general";
  let categoryAr = "عام";
  let subcategory: string | null = null;

  for (const [catKey, catInfo] of Object.entries(EQUIPMENT_CATEGORIES)) {
    for (const sub of catInfo.subcategories) {
      if (text.includes(sub)) {
        category = catKey;
        categoryAr = catInfo.ar;
        subcategory = sub;
        break;
      }
    }
    if (subcategory) break;
  }

  // Extract manufacturer from common patterns
  const manufacturer = extractManufacturer(text);
  const model = extractModel(text);
  const serialNumber = extractSerialNumber(text);

  return {
    manufacturer,
    model,
    serialNumber,
    category: categoryAr,
    subcategory,
    estimatedAge: null,
    condition: null,
    specifications: {},
  };
}

function extractManufacturer(text: string): string | null {
  const manufacturers = [
    "caterpillar", "cat", "komatsu", "volvo", "hitachi", "liebherr",
    "jcb", "doosan", "hyundai", "case", "bobcat", "john deere",
    "toyota", "nissan", "mitsubishi", "siemens", "abb", "schneider",
    "carrier", "daikin", "trane", "york", "lg", "samsung",
    "dell", "hp", "lenovo", "cisco", "huawei",
    "atlas copco", "ingersoll rand", "cummins", "perkins",
    "كاتربيلر", "كوماتسو", "فولفو", "هيتاشي", "ليبهر",
    "تويوتا", "سيمنس", "هيونداي",
  ];
  
  for (const m of manufacturers) {
    if (text.includes(m)) {
      return m.charAt(0).toUpperCase() + m.slice(1);
    }
  }
  return null;
}

function extractModel(text: string): string | null {
  // Match model patterns like "CAT 320D", "D6R", "PC200-8"
  const modelPatterns = [
    /\b([A-Z]{2,4}[-\s]?\d{2,4}[A-Z]?(?:[-]\d{1,2})?)\b/i,
    /(?:model|موديل|طراز)[:\s]*([A-Z0-9][\w-]{2,15})/i,
  ];
  
  for (const pattern of modelPatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractSerialNumber(text: string): string | null {
  const snPatterns = [
    /(?:s\/?n|serial|رقم تسلسلي)[:\s#]*([A-Z0-9][\w-]{5,20})/i,
  ];
  
  for (const pattern of snPatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Build image analysis prompt for machinery
 * This prompt is injected when user sends equipment photos
 */
export function buildMachineryVisionPrompt(): string {
  return `
## تحليل صور المعدات (عند استلام صور)
عند تحليل صورة معدة أو آلة، قدّم المعلومات التالية:

1. **النوع والفئة**: حدد نوع المعدة (ثقيلة، خفيفة، إنتاجية، كهربائية...)
2. **الشركة المصنعة**: حدد الشركة إن ظهر الشعار أو اللون المميز
3. **الموديل التقريبي**: قدّر الموديل من الشكل والمواصفات المرئية
4. **الحالة الظاهرية**: (ممتاز/جيد/متوسط/سيء) بناءً على:
   - الصدأ والتآكل
   - حالة الطلاء
   - الأجزاء المفقودة أو التالفة
   - نظافة المعدة
5. **العمر التقديري**: قدّر عمر المعدة من مظهرها
6. **لوحة البيانات**: إذا ظهرت لوحة البيانات (Nameplate)، استخرج:
   - الرقم التسلسلي (S/N)
   - سنة الصنع
   - المواصفات الفنية (القدرة، الجهد، التردد...)
7. **ملاحظات تقييمية**: أي ملاحظات تؤثر على القيمة

⚠️ نوّه دائماً أن التحليل البصري أولي ويحتاج تأكيد ميداني.
`;
}

/**
 * Analyze batch of assets and return classification summary
 */
export function classifyAssetBatch(
  assets: { name: string; description?: string }[]
): {
  section: string;
  categories: Record<string, number>;
  identifications: EquipmentIdentification[];
} {
  const categories: Record<string, number> = {};
  const identifications: EquipmentIdentification[] = [];

  for (const asset of assets) {
    const id = classifyEquipment(asset.name, asset.description);
    identifications.push(id);

    categories[id.category] = (categories[id.category] || 0) + 1;
  }

  let section = "\n\n## تصنيف الأصول التلقائي\n";
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    section += `• ${cat}: ${count} أصل\n`;
  }

  const withManufacturer = identifications.filter(i => i.manufacturer);
  if (withManufacturer.length > 0) {
    section += "\n### الشركات المصنعة المكتشفة:\n";
    const mfrs = new Set(withManufacturer.map(i => i.manufacturer!));
    section += [...mfrs].join("، ") + "\n";
  }

  return { section, categories, identifications };
}
