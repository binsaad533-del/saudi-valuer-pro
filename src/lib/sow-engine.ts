/**
 * Scope of Work Engine — محرك نطاق العمل
 * Generates legally-compliant SOW based on inspection type per IVS 2025 & Taqeem standards
 */

import type { AssetBreakdown } from "@/lib/asset-discipline-engine";

export type InspectionType = "field" | "desktop_with_photos" | "desktop_without_photos";

/** النصوص القانونية للافتراضات الخاصة حسب نوع المعاينة */
export const SPECIAL_ASSUMPTIONS: Record<InspectionType, string> = {
  field: `سيقوم المقيّم (أو من ينوب عنه من فريق المعاينة) بإجراء معاينة ميدانية بصرية للأصل للوقوف على حالته المادية الراهنة. يُفترض عدم وجود عيوب خفية لا تظهر بالعين المجردة، وأن الأصل يعمل بكفاءة ما لم يتبين خلاف ذلك أثناء الزيارة.`,

  desktop_with_photos: `بناءً على طلب العميل، يُعد هذا التقييم تقييماً مكتبياً لن يتضمن أي معاينة ميدانية أو فحص مادي للأصل. سيعتمد النظام كلياً على المستندات والصور الفوتوغرافية المقدمة من العميل.\n\nالافتراض الخاص: يُفترض صراحةً أن الصور دقيقة، حديثة، وتعكس الحالة المادية الحقيقية للأصل كما هي في تاريخ التقييم، ويخلي المقيّم مسؤوليته عن أي تلف أو عيوب لا تظهر في الصور.`,

  desktop_without_photos: `يُعد هذا التقييم تقييماً مكتبياً مستندياً بحتاً. لم تُجرَ أي معاينة ميدانية، ولم يتم تقديم أي صور فوتوغرافية للأصل.\n\nالافتراض الخاص الصارم: يفترض المقيّم أن الأصل موجود فعلياً، وأن حالته الفنية والتشغيلية تتناسب تماماً مع عمره الزمني ومستوى استخدامه الموثق في السجلات الورقية (الفواتير، الصكوك، سجلات الصيانة). إمكانية الاعتماد على هذا التقرير مقيدة بصحة هذه المستندات، ويخلي المقيّم مسؤوليته التامة عن أي تقادم مادي أو تلف فعلي لا تعكسه السجلات.`,
};

/** الافتراضات العامة (مشتركة بين جميع الأنواع) */
export const GENERAL_ASSUMPTIONS = `1. يُفترض أن جميع المعلومات والبيانات المقدمة من العميل أو الجهات الرسمية صحيحة ودقيقة.
2. يُفترض عدم وجود أي التزامات مالية أو قانونية مؤثرة على قيمة الأصل ما لم يُذكر خلاف ذلك.
3. يُفترض أن الأصل يتوافق مع أنظمة البناء والتخطيط المعمول بها.
4. يُفترض أن الاستخدام الحالي هو الأعلى والأفضل ما لم يتبين خلاف ذلك.
5. التقييم يعكس ظروف السوق في تاريخ التقييم المحدد.`;

/** ربط غرض التقييم بأساس القيمة (IVS 104) */
const PURPOSE_TO_BASIS: Record<string, { ar: string; reference: string }> = {
  sale_purchase: { ar: "القيمة السوقية", reference: "IVS 104.10" },
  mortgage: { ar: "القيمة السوقية", reference: "IVS 104.20" },
  financial_reporting: { ar: "القيمة العادلة", reference: "IVS 104.50 / IFRS 13" },
  insurance: { ar: "قيمة إعادة الإحلال", reference: "IVS 104.70" },
  taxation: { ar: "القيمة السوقية", reference: "IVS 104.10" },
  expropriation: { ar: "القيمة السوقية", reference: "IVS 104.10" },
  litigation: { ar: "القيمة السوقية", reference: "IVS 104.10" },
  investment: { ar: "قيمة الاستثمار", reference: "IVS 104.60" },
  lease_renewal: { ar: "القيمة الإيجارية السوقية", reference: "IVS 104.40" },
  internal_decision: { ar: "القيمة السوقية", reference: "IVS 104.10" },
  regulatory: { ar: "القيمة السوقية", reference: "IVS 104.10" },
  other: { ar: "القيمة السوقية", reference: "IVS 104.10" },
};

export interface SOWContext {
  clientName: string;
  purpose: string;
  purposeAr?: string;
  propertyType?: string;
  propertyAddress?: string;
  propertyCity?: string;
  inspectionType: InspectionType;
  valuationDate?: string;
  discipline?: string;
  /** Rich asset description from discipline engine */
  assetDescription?: string;
  /** Recommended methodologies */
  methodologies?: string[];
  /** Relevant IVS references */
  ivsReferences?: string[];
  /** Asset type breakdowns */
  breakdowns?: AssetBreakdown[];
  /** Whether multi-asset portfolio */
  isPortfolio?: boolean;
}

export interface GeneratedSOW {
  title: string;
  basisOfValue: string;
  basisReference: string;
  generalAssumptions: string;
  specialAssumptions: string;
  inspectionTypeLabel: string;
  sections: { heading: string; content: string }[];
}

const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  field: "معاينة ميدانية",
  desktop_with_photos: "تقييم مكتبي (مع صور)",
  desktop_without_photos: "تقييم مكتبي (بدون صور)",
};

export function generateSOW(ctx: SOWContext): GeneratedSOW {
  const basis = PURPOSE_TO_BASIS[ctx.purpose] || PURPOSE_TO_BASIS.other;
  const specialAssumptions = SPECIAL_ASSUMPTIONS[ctx.inspectionType];
  const inspectionLabel = INSPECTION_TYPE_LABELS[ctx.inspectionType];
  const purposeLabel = ctx.purposeAr || ctx.purpose;

  // Build asset description section intelligently
  let assetDescContent = `النوع: ${ctx.propertyType || "غير محدد"}\nالعنوان: ${ctx.propertyAddress || "غير محدد"}\nالمدينة: ${ctx.propertyCity || "غير محدد"}`;

  if (ctx.assetDescription) {
    assetDescContent += `\n\nتفاصيل الجرد: ${ctx.assetDescription}`;
  }

  if (ctx.breakdowns && ctx.breakdowns.length > 0) {
    assetDescContent += "\n\nتوزيع الأصول حسب النوع:";
    for (const b of ctx.breakdowns) {
      assetDescContent += `\n  • ${b.label}: ${b.count} أصل`;
      if (b.examples.length > 0) {
        assetDescContent += ` (مثال: ${b.examples.join("، ")})`;
      }
    }
  }

  if (ctx.isPortfolio) {
    assetDescContent += "\n\nملاحظة: هذا تقييم محفظة أصول متعددة — سيتم تقييم كل أصل بشكل مستقل مع ملخص موحد.";
  }

  // Build methodology section
  let methodologyContent = "";
  if (ctx.methodologies && ctx.methodologies.length > 0) {
    methodologyContent = "المنهجيات المعتمدة:\n" + ctx.methodologies.map((m, i) => `${i + 1}. ${m}`).join("\n");
    if (ctx.ivsReferences && ctx.ivsReferences.length > 0) {
      methodologyContent += `\n\nالمراجع المعيارية: ${ctx.ivsReferences.join("، ")}`;
    }
  }

  const sections: { heading: string; content: string }[] = [
    {
      heading: "1. هوية المقيّم",
      content: "المقيّم المعتمد: مسجل لدى الهيئة السعودية للمقيّمين المعتمدين (تقييم). يتم تنفيذ التقييم وفقاً لمعايير التقييم الدولية (IVS 2025) والأنظمة المحلية ذات الصلة.",
    },
    {
      heading: "2. هوية العميل",
      content: `العميل: ${ctx.clientName}`,
    },
    {
      heading: "3. غرض التقييم",
      content: `الغرض من التقييم: ${purposeLabel}`,
    },
    {
      heading: "4. أساس القيمة",
      content: `أساس القيمة المستخدم: ${basis.ar}\nالمرجع المعياري: ${basis.reference}`,
    },
    {
      heading: "5. الأصل محل التقييم",
      content: assetDescContent,
    },
    ...(methodologyContent ? [{
      heading: "6. منهجيات التقييم",
      content: methodologyContent,
    }] : []),
    {
      heading: methodologyContent ? "7. نوع المعاينة" : "6. نوع المعاينة",
      content: inspectionLabel,
    },
    {
      heading: methodologyContent ? "8. تاريخ التقييم" : "7. تاريخ التقييم",
      content: ctx.valuationDate || new Date().toISOString().split("T")[0],
    },
    {
      heading: methodologyContent ? "9. الافتراضات العامة" : "8. الافتراضات العامة",
      content: GENERAL_ASSUMPTIONS,
    },
    {
      heading: methodologyContent ? "10. الافتراضات الخاصة والمحددات" : "9. الافتراضات الخاصة والمحددات",
      content: specialAssumptions,
    },
  ];

  const disciplineLabel = (() => {
    const d = ctx.discipline || "";
    if (d === "machinery_equipment" || d === "machinery") return "آلات ومعدات";
    if (d === "mixed" || d === "both") return "مختلط (عقاري + آلات ومعدات)";
    return ctx.propertyType || "أصل";
  })();

  return {
    title: `نطاق العمل — تقييم ${disciplineLabel} لغرض ${purposeLabel}`,
    basisOfValue: basis.ar,
    basisReference: basis.reference,
    generalAssumptions: GENERAL_ASSUMPTIONS,
    specialAssumptions,
    inspectionTypeLabel: inspectionLabel,
    sections,
  };
}

/** Derive inspection type from valuation_mode and whether photos exist */
export function deriveInspectionType(
  valuationMode: string,
  hasPhotos?: boolean
): InspectionType {
  if (valuationMode === "field") return "field";
  if (hasPhotos) return "desktop_with_photos";
  return "desktop_without_photos";
}
