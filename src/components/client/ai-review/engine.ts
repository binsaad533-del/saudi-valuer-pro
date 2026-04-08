import type { ExtractedAsset, AssetSourceInfo, SmartQuestion, TriggerType } from "./types";
import {
  INTANGIBLE_RULES, CONTRACTUAL_RULES, FINANCIAL_RULES,
  EXCLUSION_RULES, KB_LICENSE, KB_INTANGIBLE, COMPANY,
} from "./constants";

// ── Verification Triggers ──
interface VerificationTrigger {
  check: (a: ExtractedAsset) => boolean;
  reason: string;
  triggerType: TriggerType;
  tag: string;
}

const VERIFICATION_TRIGGERS: VerificationTrigger[] = [
  { check: a => !a.name || a.name.trim().length < 3, reason: "اسم غير واضح — بيانات ناقصة", triggerType: "unclear_name", tag: "Incomplete" },
  { check: a => !a.category && !a.type, reason: "تصنيف غير محدد — بيانات ناقصة", triggerType: "no_category", tag: "Incomplete" },
  { check: a => a.quantity <= 0 || isNaN(a.quantity), reason: "كمية غير صحيحة — بيانات ناقصة", triggerType: "bad_quantity", tag: "Incomplete" },
  {
    check: a => {
      const name = (a.name || "").toLowerCase();
      const cat = (a.category || "").toLowerCase();
      const isNameProperty = ["أرض", "عقار", "مبنى", "فيلا", "شقة", "land", "building"].some(k => name.includes(k));
      const isCatMachinery = ["آلات", "معدات", "machinery", "equipment"].some(k => cat.includes(k));
      return isNameProperty && isCatMachinery;
    },
    reason: "تعارض بين الاسم والتصنيف",
    triggerType: "conflict",
    tag: "Conflict",
  },
  {
    check: a => {
      const name = (a.name || "").toLowerCase();
      const propertyKw = ["أرض", "عقار", "مبنى", "land", "building"];
      const machineKw = ["آلة", "معدة", "machine", "equipment", "generator"];
      return propertyKw.some(k => name.includes(k)) && machineKw.some(k => name.includes(k));
    },
    reason: "يحتوي على أنواع أصول مختلطة",
    triggerType: "mixed",
    tag: "Mixed",
  },
  { check: a => a.confidence < 35, reason: "ثقة منخفضة جداً في الاستخراج", triggerType: "low_confidence", tag: "Incomplete" },
];

// ── Classification ──
export function classifyAssetLicense(asset: ExtractedAsset): ExtractedAsset {
  const combined = `${(asset.category || asset.type || "").toLowerCase()} ${(asset.name || "").toLowerCase()}`;

  for (const rule of INTANGIBLE_RULES) {
    if (rule.keywords.some(k => combined.includes(k.toLowerCase()))) {
      return { ...asset, license_status: "not_permitted", license_reason: rule.reason };
    }
  }
  for (const rule of CONTRACTUAL_RULES) {
    if (rule.keywords.some(k => combined.includes(k.toLowerCase()))) {
      return { ...asset, license_status: "not_permitted", license_reason: rule.reason };
    }
  }
  for (const rule of FINANCIAL_RULES) {
    if (rule.keywords.some(k => combined.includes(k.toLowerCase()))) {
      return { ...asset, license_status: "not_permitted", license_reason: rule.reason };
    }
  }
  for (const trigger of VERIFICATION_TRIGGERS) {
    if (trigger.check(asset)) {
      return { ...asset, license_status: "needs_review", license_reason: trigger.reason };
    }
  }
  return { ...asset, license_status: "permitted", license_reason: "تمت المعالجة تلقائياً" };
}

export function isHardExcluded(asset: ExtractedAsset): boolean {
  const combined = `${(asset.category || asset.type || "").toLowerCase()} ${(asset.name || "").toLowerCase()}`;
  return EXCLUSION_RULES.some(rule => rule.keywords.some(k => combined.includes(k.toLowerCase())));
}

export function consistencyCheck(assets: ExtractedAsset[]): ExtractedAsset[] {
  const fingerprints = new Map<string, ExtractedAsset["license_status"]>();
  return assets.map(a => {
    const fp = `${(a.name || "").trim().toLowerCase()}|${(a.category || "").toLowerCase()}|${(a.type || "").toLowerCase()}`;
    const existing = fingerprints.get(fp);
    if (existing && existing !== a.license_status) {
      const strict = existing === "not_permitted" || a.license_status === "not_permitted" ? "not_permitted"
        : existing === "needs_review" || a.license_status === "needs_review" ? "needs_review" : "permitted";
      fingerprints.set(fp, strict);
      return { ...a, license_status: strict };
    }
    fingerprints.set(fp, a.license_status);
    return a;
  });
}

// ── Deduplication ──
export function deduplicateAssets(assets: ExtractedAsset[]) {
  const seen = new Map<string, ExtractedAsset>();
  const duplicateNames: string[] = [];
  for (const asset of assets) {
    const key = `${(asset.name || "").trim().toLowerCase()}|${(asset.category || "").toLowerCase()}|${(asset.source || "").toLowerCase()}`;
    const existing = seen.get(key);
    if (existing) {
      existing.quantity += asset.quantity;
      if (asset.confidence > existing.confidence) existing.confidence = asset.confidence;
      duplicateNames.push(asset.name || "بدون اسم");
    } else {
      seen.set(key, { ...asset });
    }
  }
  const unique = Array.from(seen.values());
  return { unique, removedCount: assets.length - unique.length, duplicateNames };
}

// ── Exclusion Explanation ──
export function buildExclusionExplanation(excludedAssets: ExtractedAsset[]): string {
  const groups = new Map<string, { names: string[]; ref: typeof KB_LICENSE }>();
  for (const a of excludedAssets) {
    const matchedRule = EXCLUSION_RULES.find(r =>
      r.keywords.some(k => (a.name || "").toLowerCase().includes(k.toLowerCase()) || (a.license_reason || "").includes(k))
    );
    const ref = matchedRule?.ref || KB_LICENSE;
    const reason = a.license_reason || "خارج نطاق التقييم";
    const existing = groups.get(reason) || { names: [], ref };
    existing.names.push(a.name);
    groups.set(reason, existing);
  }
  let text = `🚫 تم استبعاد ${excludedAssets.length} بند تلقائياً:\n`;
  for (const [reason, { names, ref }] of groups) {
    const preview = names.slice(0, 3).map(n => `"${n}"`).join("، ");
    const extra = names.length > 3 ? ` و${names.length - 3} آخرين` : "";
    text += `\n• ${preview}${extra}\n  ← ${reason}\n  📖 المرجع: ${ref.source} — ${ref.article}`;
  }
  text += `\n\n⚖️ الأساس النظامي:\n${KB_LICENSE.source}\n${KB_LICENSE.article}: ${KB_LICENSE.principle}`;
  return text;
}

export function buildExclusionReply(excludedCount: number): string {
  const branchLines = COMPANY.branches.map(b => `• ${b.name} — ${b.label} رقم ${b.license}`).join("\n");
  return `${COMPANY.name_ar} مرخصة من ${COMPANY.authority} في فرعين:

${branchLines}
السجل التجاري: ${COMPANY.cr_number}

وهذا التقييم يندرج ضمن تقييم المنشآت الاقتصادية، ويشمل فقط الأصول الملموسة (عقارات، آلات، معدات، مركبات).

أما الأصول غير الملموسة (علامات تجارية، برمجيات، شهرة، تراخيص) فتتطلب ترخيصاً مستقلاً في فرع "تقييم المنشآت الاقتصادية".

📖 الأساس النظامي:
• ${KB_LICENSE.source} — ${KB_LICENSE.article}
• ${KB_INTANGIBLE.source} — ${KB_INTANGIBLE.article}

عدد البنود المستبعدة: ${excludedCount} بند.`;
}

// ── Smart Questions ──
function detectTriggerType(asset: ExtractedAsset): TriggerType {
  for (const t of VERIFICATION_TRIGGERS) {
    if (t.check(asset)) return t.triggerType;
  }
  return "low_confidence";
}

function generateSingleQuestion(asset: ExtractedAsset, triggerType: TriggerType): SmartQuestion {
  const base = { id: `single-${asset.id}`, assetIds: [asset.id], triggerType };
  switch (triggerType) {
    case "unclear_name":
      return { ...base, question: `"${asset.name || "—"}" — اسم غير واضح. ما الاسم الصحيح؟`, options: [{ label: "استبعاد", action: "exclude" }], allowCustom: true, customPlaceholder: "الاسم الصحيح..." } as SmartQuestion;
    case "no_category":
      return { ...base, question: `"${asset.name}" — ما تصنيفه؟`, options: [{ label: "عقار", action: "update", updateField: "category", updateValue: "real_estate" }, { label: "آلات ومعدات", action: "update", updateField: "category", updateValue: "machinery_equipment" }, { label: "استبعاد", action: "exclude" }], allowCustom: true, customPlaceholder: "تصنيف آخر..." } as SmartQuestion;
    case "bad_quantity":
      return { ...base, question: `"${asset.name}" — الكمية (${asset.quantity}) غير صحيحة. ما العدد؟`, options: [{ label: "1", action: "update", updateField: "quantity", updateValue: "1" }, { label: "استبعاد", action: "exclude" }], allowCustom: true, customPlaceholder: "الكمية..." } as SmartQuestion;
    case "conflict":
      return { ...base, question: `"${asset.name}" مصنف كـ "${asset.category}" — تعارض. صحيح؟`, options: [{ label: "نعم", action: "approve" }, { label: "عقار", action: "update", updateField: "category", updateValue: "real_estate" }, { label: "استبعاد", action: "exclude" }], allowCustom: false } as SmartQuestion;
    case "mixed":
      return { ...base, question: `"${asset.name}" يحتوي أنواع مختلطة. ما التصنيف الصحيح؟`, options: [{ label: "عقار", action: "update", updateField: "category", updateValue: "real_estate" }, { label: "آلات ومعدات", action: "update", updateField: "category", updateValue: "machinery_equipment" }, { label: "استبعاد", action: "exclude" }], allowCustom: true, customPlaceholder: "تصنيف آخر..." } as SmartQuestion;
    default:
      return { ...base, question: `"${asset.name}" — ثقة ${asset.confidence}%. تضمينه؟`, options: [{ label: "نعم", action: "approve" }, { label: "لا", action: "exclude" }], allowCustom: false } as SmartQuestion;
  }
}

export function generateSmartQuestions(flaggedAssets: ExtractedAsset[]): SmartQuestion[] {
  if (flaggedAssets.length === 0) return [];
  const groups = new Map<TriggerType, ExtractedAsset[]>();
  for (const asset of flaggedAssets) {
    const trigger = detectTriggerType(asset);
    const list = groups.get(trigger) || [];
    list.push(asset);
    groups.set(trigger, list);
  }
  const questions: SmartQuestion[] = [];
  for (const [trigger, assets] of groups) {
    if (assets.length > 1 && (trigger === "low_confidence" || trigger === "no_category")) {
      const names = assets.slice(0, 3).map(a => `"${a.name}"`).join("، ");
      const extra = assets.length > 3 ? ` و${assets.length - 3} آخرين` : "";
      if (trigger === "low_confidence") {
        questions.push({
          id: `group-${trigger}`, assetIds: assets.map(a => a.id), triggerType: trigger,
          question: `${names}${extra} — ثقة منخفضة. تضمينها؟`,
          options: [{ label: "نعم", action: "approve" }, { label: "لا، استبعاد", action: "exclude" }],
          allowCustom: false,
        });
      } else {
        questions.push({
          id: `group-${trigger}`, assetIds: assets.map(a => a.id), triggerType: trigger,
          question: `${names}${extra} — بدون تصنيف. ما نوعها؟`,
          options: [
            { label: "عقار", action: "update", updateField: "category", updateValue: "real_estate" },
            { label: "آلات ومعدات", action: "update", updateField: "category", updateValue: "machinery_equipment" },
            { label: "استبعاد", action: "exclude" },
          ],
          allowCustom: true, customPlaceholder: "تصنيف آخر...",
        });
      }
    } else {
      for (const asset of assets) {
        questions.push(generateSingleQuestion(asset, trigger));
      }
    }
  }
  return questions;
}

// ── Source Label Helper ──
export function sourceLabel(s?: AssetSourceInfo): string {
  if (!s) return "—";
  const icon = s.file_type === "excel" ? "📊" : s.file_type === "pdf" ? "📄" : s.file_type === "image" ? "🖼" : "📎";
  if (s.file_type === "excel" && s.sheet_name) return `${icon} ${s.sheet_name} ص${s.row_number ?? ""}`;
  if (s.file_type === "pdf" && s.page_number) return `${icon} ص${s.page_number}`;
  return `${icon} ${s.file_name?.slice(0, 15) ?? "ملف"}`;
}
