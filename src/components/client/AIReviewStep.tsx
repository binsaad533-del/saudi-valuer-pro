import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildSafeStorageObject, getUploadErrorMessage } from "@/lib/storage-path";
import { parseExcelFile, autoMapColumns, applyMapping } from "@/lib/excel-parser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CheckCircle, Cog, Sparkles, Building2,
  Shield, ArrowRight, Package, FileCheck, Send,
  FileText, AlertCircle, Eye, Paperclip, Image, Loader2, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ── Types ──
export interface AssetSourceInfo {
  file_name: string;
  file_type: "excel" | "pdf" | "image" | "unknown";
  sheet_name?: string;
  row_number?: number;
  page_number?: number;
  region?: string;
}

export interface ExtractedAsset {
  id: number;
  name: string;
  type: string;
  category: string | null;
  quantity: number;
  condition: string;
  confidence: number;
  source: string;
  license_status: "permitted" | "not_permitted" | "needs_review";
  license_reason?: string;
  ai_suggestion?: string;
  source_info?: AssetSourceInfo;
}

export interface AIReviewData {
  detectedType: string;
  confirmedType: string;
  confidence: number;
  assets: ExtractedAsset[];
  totalFiles: number;
  clientName?: string;
}

interface Props {
  data: AIReviewData;
  onApprove: (approved: ExtractedAsset[], notes: string) => void;
  onBack: () => void;
}

// ── Company Identity & Credentials (Source: jsaas-valuation.com + official docs) ──
const COMPANY = {
  name_ar: "شركة جسّاس للتقييم",
  name_en: "Jsaas Valuation",
  legal_form: "شركة ذات مسؤولية محدودة (مهنية)",
  cr_number: "1010625839",
  vat_number: "310625839900003",
  unified_number: "7016803038",
  cr_date: "2020/02/05",
  ceo: "أحمد سعد المالكي",
  ceo_id: "1017487701",
  website: "www.jsaas-valuation.com",
  email: "care@jsaas-valuation.com",
  phone: "920015029",
  mobile: "966500668089",
  address: "السعودية — الرياض — حي الياسمين — طريق الثمامة",
  bank: { name: "مصرف الراجحي", iban: "SA7080000611608010112580" },
  branches: [
    {
      name: "تقييم العقارات",
      name_en: "Real Estate Valuation",
      license: "1210001217",
      fellowship: "1210001217",
      label: "ترخيص وعضوية زمالة",
      expiry: "2026-12-31",
    },
    {
      name: "تقييم الآلات والمعدات",
      name_en: "Machinery & Equipment Valuation",
      license: "4114000015",
      fellowship: "4210000041",
      label: "ترخيص + عضوية زمالة",
      expiry: "2026-12-31",
    },
  ],
  authority: "الهيئة السعودية للمقيمين المعتمدين (تقييم)",
  accreditations: [
    "عضوية الزمالة — الهيئة السعودية للمقيمين المعتمدين (TAQEEM)",
    "اعتماد الجمعية الأمريكية للمقيّمين (ASA) — USPAP",
    "التوافق مع معايير التقييم الدولية (IVS)",
  ],
  services: [
    "تقييم العقارات",
    "تقييم الآلات والمعدات",
    "نزع الملكية والتعويضات",
  ],
  vision: "نصنع للأصل قيمة",
  mission: "نقيّم الأصول بعِلم وفنْ",
  values: "الكفاءة والاستقلالية",
  achievements: {
    total_assets_valued: "111,641+ أصل",
    total_value: "1.185+ مليار ريال سعودي",
  },
  strengths: [
    "الثقة — شركة سعودية مرخصة بسجل إنجازات معتمدة",
    "المرونة — نتعامل مع المشاريع الصغيرة والكبيرة بنفس الكفاءة",
    "القيمة مقابل التكلفة — جودة بأسعار منطقية وتنفيذ سريع",
    "الالتزام والتنظيم — إدارة رقمية وجدولة تضمن التسليم في الوقت",
  ],
  permitted_assets: ["عقارات", "أراضي", "مباني", "فلل", "شقق", "آلات", "معدات", "مركبات", "أثاث", "أجهزة"],
  excluded_scope: "تقييم المنشآت الاقتصادية (Business Valuation) — يتطلب ترخيصاً مستقلاً",
  valuation_purposes: [
    "التأمين", "الرهن", "التمويل", "البيع والشراء",
    "الاندماج والاستحواذ", "التصفية", "التركات ونزع الملكية",
    "تقدير القيمة الإيجارية", "تحليل القيمة المتبقية", "الحسابات والمراجعة",
  ],
};

// ── Professional Knowledge References ──
interface KnowledgeRef {
  source: string;
  article: string;
  principle: string;
}

const KB_INTANGIBLE: KnowledgeRef = {
  source: "IVS 210 — Intangible Assets",
  article: "الفقرة 210.1",
  principle: "الأصول غير الملموسة تتطلب ترخيصاً مستقلاً في فرع تقييم المنشآت الاقتصادية (Business Valuation) ولا تدخل ضمن ترخيص العقار أو الآلات والمعدات",
};

const KB_CONTRACTUAL: KnowledgeRef = {
  source: "IVS 105 — Valuation Approaches",
  article: "الفقرة 105.3",
  principle: "الحقوق التعاقدية ليست أصولاً ملموسة قابلة للتقييم ضمن نطاق ترخيص العقار والآلات",
};

const KB_FINANCIAL: KnowledgeRef = {
  source: "IVS 500 — Financial Instruments",
  article: "الفقرة 500.1",
  principle: "الأدوات المالية تخضع لمعايير تقييم مختلفة وتتطلب ترخيصاً في فرع تقييم المنشآت الاقتصادية",
};

const KB_LICENSE: KnowledgeRef = {
  source: `نظام المقيمين المعتمدين — ${COMPANY.authority}`,
  article: "المادة 5 — فروع التقييم",
  principle: "يُرخص للمقيم في فروع محددة: العقار، الآلات والمعدات، المنشآت الاقتصادية، أو أضرار المركبات. لا يجوز ممارسة التقييم في فرع غير مرخص فيه",
};

// ── LAYER 1: Hard Exclusion — Intangible Assets (NOT_PERMITTED, immutable) ──
const INTANGIBLE_RULES: { keywords: string[]; tag: string; reason: string; ref: KnowledgeRef }[] = [
  { keywords: ["intangible", "أصول غير ملموسة", "غير ملموس"], tag: "Intangible", reason: "أصل غير ملموس — خارج نطاق ترخيص العقار والآلات", ref: KB_INTANGIBLE },
  { keywords: ["goodwill", "شهرة", "شهرة محل"], tag: "Intangible", reason: "شهرة محل (Goodwill) — أصل غير ملموس يتطلب ترخيص منشآت اقتصادية", ref: KB_INTANGIBLE },
  { keywords: ["trademark", "علامة تجارية", "brand", "logo", "شعار"], tag: "Intangible", reason: "علامة تجارية — أصل غير ملموس (IVS 210)", ref: KB_INTANGIBLE },
  { keywords: ["patent", "براءة اختراع", "براءة"], tag: "Intangible", reason: "براءة اختراع — ملكية فكرية خارج نطاق الترخيص", ref: KB_INTANGIBLE },
  { keywords: ["copyright", "حقوق ملكية فكرية", "حقوق نشر"], tag: "Intangible", reason: "حقوق ملكية فكرية — تتطلب ترخيص منشآت اقتصادية", ref: KB_INTANGIBLE },
  { keywords: ["software", "software_license", "رخصة برمجية", "برنامج", "برمجيات"], tag: "Intangible", reason: "برمجيات / رخصة برمجية — أصل غير ملموس (IVS 210)", ref: KB_INTANGIBLE },
  { keywords: ["license", "ترخيص", "رخصة"], tag: "Intangible", reason: "رخصة / ترخيص — أصل غير ملموس", ref: KB_INTANGIBLE },
  { keywords: ["customer_list", "قائمة عملاء", "customer relationship"], tag: "Intangible", reason: "علاقات عملاء — أصل غير ملموس (IVS 210)", ref: KB_INTANGIBLE },
  { keywords: ["domain_name", "نطاق", "اسم نطاق"], tag: "Intangible", reason: "اسم نطاق — أصل غير ملموس رقمي", ref: KB_INTANGIBLE },
];

// ── LAYER 2: Hard Exclusion — Contractual Rights (NOT_PERMITTED, immutable) ──
const CONTRACTUAL_RULES: { keywords: string[]; tag: string; reason: string; ref: KnowledgeRef }[] = [
  { keywords: ["contract", "عقد", "اتفاقية", "agreement"], tag: "Contractual", reason: "حق تعاقدي وليس أصل ملموس (IVS 105)", ref: KB_CONTRACTUAL },
  { keywords: ["concession", "امتياز حكومي", "حق انتفاع"], tag: "Contractual", reason: "حق امتياز / انتفاع — ليس أصلاً ملموساً", ref: KB_CONTRACTUAL },
  { keywords: ["franchise", "امتياز", "حق امتياز"], tag: "Contractual", reason: "حق امتياز تجاري — ليس أصلاً ملموساً (IVS 105)", ref: KB_CONTRACTUAL },
];

// ── LAYER 3: Hard Exclusion — Financial Instruments (NOT_PERMITTED, immutable) ──
const FINANCIAL_RULES: { keywords: string[]; tag: string; reason: string; ref: KnowledgeRef }[] = [
  { keywords: ["financial_instrument", "stock", "bond", "derivative", "أسهم", "سندات", "مشتقات", "أداة مالية"], tag: "Financial", reason: "أداة مالية — تخضع لمعيار IVS 500 المستقل", ref: KB_FINANCIAL },
  { keywords: ["cryptocurrency", "عملة رقمية", "بتكوين", "crypto"], tag: "Financial", reason: "عملة رقمية — أداة مالية خارج نطاق الترخيص", ref: KB_FINANCIAL },
];

// Combined exclusion rules
const EXCLUSION_RULES = [...INTANGIBLE_RULES, ...CONTRACTUAL_RULES, ...FINANCIAL_RULES];

// ── Knowledge-Grounded Response Builder ──
function buildExclusionExplanation(excludedAssets: ExtractedAsset[]): string {
  const groups = new Map<string, { names: string[]; ref: KnowledgeRef }>();
  
  for (const a of excludedAssets) {
    const matchedRule = EXCLUSION_RULES.find(r =>
      r.keywords.some(k => (a.name || "").toLowerCase().includes(k.toLowerCase()) || (a.license_reason || "").includes(k))
    );
    const ref = matchedRule?.ref || KB_LICENSE;
    const reason = a.license_reason || "خارج نطاق التقييم";
    const key = reason;
    const existing = groups.get(key) || { names: [], ref };
    existing.names.push(a.name);
    groups.set(key, existing);
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

function buildExclusionReply(excludedCount: number): string {
  const branchLines = COMPANY.branches.map(b => `• ${b.name} — ${b.label} رقم ${b.license}`).join("\n");
  return `${COMPANY.name_ar} مرخصة من ${COMPANY.authority} في فرعين:

${branchLines}
السجل التجاري: ${COMPANY.cr_number}

وهذا التقييم يندرج ضمن تقييم المنشآت الاقتصادية، ويشمل فقط الأصول الملموسة (عقارات، آلات، معدات، مركبات).

أما الأصول غير الملموسة (علامات تجارية، برمجيات، شهرة، تراخيص) فتتطلب ترخيصاً مستقلاً في فرع "تقييم المنشآت الاقتصادية".

📖 الأساس النظامي:
• ${KB_LICENSE.source} — ${KB_LICENSE.article}
• ${KB_INTANGIBLE.source} — ${KB_INTANGIBLE.article}

عدد البنود المستبعدة: ${excludedCount} بند.`
}

// ── LAYER 4: Verification triggers (NEEDS_REVIEW) ──
type TriggerType = "low_confidence" | "unclear_name" | "no_category" | "bad_quantity" | "conflict" | "mixed";

interface VerificationTrigger {
  check: (a: ExtractedAsset) => boolean;
  reason: string;
  triggerType: TriggerType;
  tag: string;
}

const VERIFICATION_TRIGGERS: VerificationTrigger[] = [
  // Missing data checks
  { check: a => !a.name || a.name.trim().length < 3, reason: "اسم غير واضح — بيانات ناقصة", triggerType: "unclear_name", tag: "Incomplete" },
  { check: a => !a.category && !a.type, reason: "تصنيف غير محدد — بيانات ناقصة", triggerType: "no_category", tag: "Incomplete" },
  { check: a => a.quantity <= 0 || isNaN(a.quantity), reason: "كمية غير صحيحة — بيانات ناقصة", triggerType: "bad_quantity", tag: "Incomplete" },
  // Conflict check
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
  // Mixed asset check (name suggests multiple types)
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
  // Low confidence (last priority)
  { check: a => a.confidence < 35, reason: "ثقة منخفضة جداً في الاستخراج", triggerType: "low_confidence", tag: "Incomplete" },
];

const TYPE_LABELS: Record<string, string> = {
  real_estate: "عقار",
  machinery_equipment: "آلات ومعدات",
  furniture: "أثاث",
  vehicle: "مركبة",
  it_equipment: "تقنية",
  medical_equipment: "طبي",
};

const ASSET_TYPE_MAP: Record<string, { label: string; icon: typeof Building2 }> = {
  real_estate: { label: "عقار", icon: Building2 },
  machinery_equipment: { label: "آلات ومعدات", icon: Cog },
  both: { label: "عقار + آلات ومعدات", icon: Sparkles },
};

// ── High Risk Detection Engine ──
export function classifyAssetLicense(asset: ExtractedAsset): ExtractedAsset {
  const combined = `${(asset.category || asset.type || "").toLowerCase()} ${(asset.name || "").toLowerCase()}`;

  // LAYER 1: Intangible → NOT_PERMITTED (STOP)
  for (const rule of INTANGIBLE_RULES) {
    if (rule.keywords.some(k => combined.includes(k.toLowerCase()))) {
      return { ...asset, license_status: "not_permitted", license_reason: rule.reason };
    }
  }
  // LAYER 2: Contractual → NOT_PERMITTED (STOP)
  for (const rule of CONTRACTUAL_RULES) {
    if (rule.keywords.some(k => combined.includes(k.toLowerCase()))) {
      return { ...asset, license_status: "not_permitted", license_reason: rule.reason };
    }
  }
  // LAYER 3: Financial → NOT_PERMITTED (STOP)
  for (const rule of FINANCIAL_RULES) {
    if (rule.keywords.some(k => combined.includes(k.toLowerCase()))) {
      return { ...asset, license_status: "not_permitted", license_reason: rule.reason };
    }
  }
  // LAYER 4: Verification triggers → NEEDS_REVIEW
  for (const trigger of VERIFICATION_TRIGGERS) {
    if (trigger.check(asset)) {
      return { ...asset, license_status: "needs_review", license_reason: trigger.reason };
    }
  }
  // LAYER 5: All clear → PERMITTED
  return { ...asset, license_status: "permitted", license_reason: "تمت المعالجة تلقائياً" };
}

/** Check if asset is hard-excluded by EXCLUSION_RULES (immutable, cannot be overridden) */
function isHardExcluded(asset: ExtractedAsset): boolean {
  const combined = `${(asset.category || asset.type || "").toLowerCase()} ${(asset.name || "").toLowerCase()}`;
  return EXCLUSION_RULES.some(rule => rule.keywords.some(k => combined.includes(k.toLowerCase())));
}

/** Consistency check: same input → same output (deterministic) */
function consistencyCheck(assets: ExtractedAsset[]): ExtractedAsset[] {
  const fingerprints = new Map<string, ExtractedAsset["license_status"]>();
  return assets.map(a => {
    const fp = `${(a.name || "").trim().toLowerCase()}|${(a.category || "").toLowerCase()}|${(a.type || "").toLowerCase()}`;
    const existing = fingerprints.get(fp);
    if (existing && existing !== a.license_status) {
      // Force consistency: same data = same result (use the stricter status)
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
function deduplicateAssets(assets: ExtractedAsset[]) {
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

// ── Smart Question generation ──
interface SmartQuestion {
  id: string;
  assetIds: number[];
  question: string;
  options: { label: string; action: "approve" | "exclude" | "update"; updateField?: string; updateValue?: string }[];
  allowCustom: boolean;
  customPlaceholder?: string;
  triggerType: TriggerType;
}

function detectTriggerType(asset: ExtractedAsset): TriggerType {
  for (const t of VERIFICATION_TRIGGERS) {
    if (t.check(asset)) return t.triggerType;
  }
  return "low_confidence";
}

function generateSmartQuestions(flaggedAssets: ExtractedAsset[]): SmartQuestion[] {
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
          options: [
            { label: "نعم", action: "approve" },
            { label: "لا، استبعاد", action: "exclude" },
          ],
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

// ── Source helpers ──
function sourceLabel(s?: AssetSourceInfo): string {
  if (!s) return "—";
  const icon = s.file_type === "excel" ? "📊" : s.file_type === "pdf" ? "📄" : s.file_type === "image" ? "🖼" : "📎";
  if (s.file_type === "excel" && s.sheet_name) return `${icon} ${s.sheet_name} ص${s.row_number ?? ""}`;
  if (s.file_type === "pdf" && s.page_number) return `${icon} ص${s.page_number}`;
  return `${icon} ${s.file_name?.slice(0, 15) ?? "ملف"}`;
}

// ── Chat message ──
interface ChatMessage {
  id: string;
  type: "system" | "question" | "answer" | "info";
  text: string;
  questionData?: SmartQuestion;
  timestamp: number;
}

// ── Status badge ──
function StatusBadge({ status }: { status: ExtractedAsset["license_status"] }) {
  if (status === "permitted") return <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-[9px] px-1.5 py-0">✓ جاهز</Badge>;
  if (status === "not_permitted") return <Badge variant="destructive" className="text-[9px] px-1.5 py-0">✗ مستبعد</Badge>;
  return <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-200 text-[9px] px-1.5 py-0 animate-pulse">⟳ بانتظار</Badge>;
}

// ══════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════
export default function AIReviewStep({ data, onApprove, onBack }: Props) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [sourceDetail, setSourceDetail] = useState<AssetSourceInfo | null>(null);

  const { processed, removedCount, duplicateNames } = useMemo(() => {
    const { unique, removedCount, duplicateNames } = deduplicateAssets(data.assets);
    const classified = unique.map(a => {
      if (a.license_status === "not_permitted" && a.license_reason) return a;
      return classifyAssetLicense(a);
    });
    const processed = consistencyCheck(classified);
    return { processed, removedCount, duplicateNames };
  }, [data.assets]);

  const [assets, setAssets] = useState<ExtractedAsset[]>(processed);
  const [additionalNotes, setAdditionalNotes] = useState("");

  const autoApproved = useMemo(() => assets.filter(a => a.license_status === "permitted"), [assets]);
  const excluded = useMemo(() => assets.filter(a => a.license_status === "not_permitted"), [assets]);
  const flagged = useMemo(() => assets.filter(a => a.license_status === "needs_review"), [assets]);

  const [questions] = useState<SmartQuestion[]>(() => generateSmartQuestions(processed.filter(a => a.license_status === "needs_review")));
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [phase, setPhase] = useState<"questions" | "final" | "done">(questions.length === 0 ? "final" : "questions");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [freeText, setFreeText] = useState("");

  // Track if AI is thinking
  const [isThinking, setIsThinking] = useState(false);

  // Build asset context string for AI
  const assetContextStr = useMemo(() => {
    return `📊 إحصائيات الأصول:
• إجمالي الأصول الأصلية المرفوعة: ${data.assets.length}
• عناصر مكررة تم إزالتها تلقائياً: ${removedCount}${removedCount > 0 ? ` (أمثلة: ${[...new Set(duplicateNames)].slice(0, 15).join("، ")})` : ""}
• الأصول الفريدة بعد الدمج: ${assets.length}
• جاهز للتقييم: ${autoApproved.length} ✅
• مستبعد (خارج نطاق الترخيص): ${excluded.length} 🚫${excluded.length > 0 ? `\n  المستبعدة: ${excluded.map(a => `"${a.name}" — ${a.license_reason || "خارج النطاق"}`).join("، ")}` : ""}
• بانتظار التوضيح: ${flagged.length} ❓${flagged.length > 0 ? `\n  بانتظار المراجعة: ${flagged.map(a => `"${a.name}" — ${a.license_reason || "بيانات ناقصة"}`).join("، ")}` : ""}`;
  }, [data.assets.length, removedCount, duplicateNames, assets.length, autoApproved.length, excluded, flagged]);

  // Build detailed asset list for AI deep context
  const assetDetailsStr = useMemo(() => {
    const lines: string[] = [];
    
    // Show all duplicate names
    if (duplicateNames.length > 0) {
      const uniqueDups = [...new Set(duplicateNames)];
      lines.push(`\n### العناصر المكررة التي تم دمجها (${removedCount} عنصر):`);
      uniqueDups.forEach((name, i) => {
        const count = duplicateNames.filter(n => n === name).length;
        lines.push(`${i + 1}. "${name}" — تكرر ${count + 1} مرة (تم الإبقاء على نسخة واحدة)`);
      });
    }

    // Show approved assets
    if (autoApproved.length > 0) {
      lines.push(`\n### الأصول المعتمدة للتقييم (${autoApproved.length}):`);
      autoApproved.slice(0, 50).forEach((a, i) => {
        lines.push(`${i + 1}. "${a.name}" | النوع: ${a.type || "غير محدد"} | التصنيف: ${a.category || "—"} | الكمية: ${a.quantity} | الحالة: ${a.condition || "—"} | المصدر: ${a.source || "—"} | الثقة: ${Math.round(a.confidence * 100)}%`);
      });
      if (autoApproved.length > 50) lines.push(`... و${autoApproved.length - 50} أصل آخر`);
    }

    // Show excluded with reasons
    if (excluded.length > 0) {
      lines.push(`\n### الأصول المستبعدة (${excluded.length}):`);
      excluded.forEach((a, i) => {
        lines.push(`${i + 1}. "${a.name}" — السبب: ${a.license_reason || "خارج نطاق الترخيص"}`);
      });
    }

    // Show flagged
    if (flagged.length > 0) {
      lines.push(`\n### أصول بانتظار التوضيح (${flagged.length}):`);
      flagged.forEach((a, i) => {
        lines.push(`${i + 1}. "${a.name}" — السبب: ${a.license_reason || "بيانات ناقصة"}`);
      });
    }

    return lines.join("\n");
  }, [duplicateNames, removedCount, autoApproved, excluded, flagged]);

  // Free-text message from client
  const handleFreeTextSend = useCallback(async () => {
    if (!freeText.trim() || isThinking) return;
    const text = freeText.trim();
    setFreeText("");

    // Add client message
    setMessages(prev => [...prev, {
      id: `client-${Date.now()}`,
      type: "answer",
      text,
      timestamp: Date.now(),
    }]);

    // Show thinking indicator
    setIsThinking(true);

    try {
      const { data: fnData } = await supabase.functions.invoke("raqeem-client-chat", {
        body: {
          message: text,
          conversationHistory: messages.filter(m => m.type === "answer" || m.type === "system").slice(-12),
          assetContext: assetContextStr,
          assetDetails: assetDetailsStr,
        },
      });

      const reply = fnData?.reply || "عذراً، حدث خطأ تقني. سأنقل استفسارك للفريق المختص.";

      setMessages(prev => [...prev, {
        id: `raqeem-${Date.now()}`,
        type: "system",
        text: reply,
        timestamp: Date.now(),
      }]);

      // Store as additional note if it seems like client feedback
      if (!["من أنتم", "ترخيص", "تواصل", "خدمات", "سلام", "هلا", "شكرا"].some(k => text.includes(k))) {
        setAdditionalNotes(prev => prev ? `${prev}\n${text}` : text);
      }
    } catch (err) {
      console.error("Raqeem chat error:", err);
      setMessages(prev => [...prev, {
        id: `raqeem-err-${Date.now()}`,
        type: "system",
        text: "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى أو التواصل معنا على 920015029.",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsThinking(false);
    }
  }, [freeText, isThinking, messages, assetContextStr, assetDetailsStr]);


  // Compute initial excluded from processed data
  const initialExcluded = useMemo(() => processed.filter(a => a.license_status === "not_permitted"), [processed]);

  // Initialize chat — Raqeem ALWAYS activates
  useEffect(() => {
    const initial: ChatMessage[] = [];
    const clientGreeting = data.clientName ? `أهلاً وسهلاً ${data.clientName}` : "أهلاً وسهلاً بك";
    const greeting = `${clientGreeting} 👋

أنا رقيم، مساعدك الذكي في ${COMPANY.name_ar}.
مهمتي مساعدتك في مراجعة الأصول المرفقة والإجابة على استفساراتك بدقة واحترافية.

راجعت المرفقات وهذا ملخص النتائج:`;
    initial.push({ id: "greeting", type: "system", text: greeting, timestamp: Date.now() });

    // CASE 1: Explain excluded items FIRST (priority) — with knowledge references
    if (initialExcluded.length > 0) {
      const explanationText = buildExclusionExplanation(initialExcluded);
      initial.push({ id: "excluded-explain", type: "info", text: explanationText, timestamp: Date.now() + 1 });
    }

    // CASE 2: Then ask about review items
    if (questions.length > 0) {
      const reviewIntro = initialExcluded.length > 0
        ? `وأحتاج تأكيد بسيط على ${questions.length} بند آخر`
        : `${questions.length} بند يحتاج تأكيد بسيط`;
      initial.push({ id: "review-intro", type: "info", text: `❓ ${reviewIntro}`, timestamp: Date.now() + 2 });
      initial.push({ id: `q-0`, type: "question", text: questions[0].question, questionData: questions[0], timestamp: Date.now() + 3 });
    }

    // CASE 3: Nothing excluded, nothing to review — confirm all clear
    if (initialExcluded.length === 0 && questions.length === 0) {
      initial.push({ id: "all-clear", type: "info", text: `✅ تم تحليل ${processed.length} بند — جميعها جاهزة للتقييم`, timestamp: Date.now() + 1 });
    }

    setMessages(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const resolveAssets = useCallback((ids: number[], status: "permitted" | "not_permitted", reason: string, updates?: Partial<ExtractedAsset>) => {
    setAssets(prev => prev.map(a => {
      if (!ids.includes(a.id)) return a;
      // IMMUTABLE: never override exclusion rules — excluded assets cannot be changed via chat
      if (a.license_status === "not_permitted" && isHardExcluded(a)) return a;
      return { ...a, ...updates, license_status: status, license_reason: reason };
    }));
  }, []);

  const advanceToNext = useCallback((answerText: string) => {
    setMessages(prev => [...prev, { id: `a-${currentQIdx}`, type: "answer", text: answerText, timestamp: Date.now() }]);
    setShowCustomInput(false);
    setCustomValue("");
    const nextIdx = currentQIdx + 1;
    if (nextIdx < questions.length) {
      setCurrentQIdx(nextIdx);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: `q-${nextIdx}`, type: "question", text: questions[nextIdx].question, questionData: questions[nextIdx], timestamp: Date.now() }]);
      }, 250);
    } else {
      setPhase("final");
      setTimeout(() => {
        setMessages(prev => [...prev, { id: "final-q", type: "question", text: "هل ترغب بإضافة معلومات مهمة قد تؤثر على التقييم؟", timestamp: Date.now() }]);
      }, 250);
    }
  }, [currentQIdx, questions]);

  const handleOptionClick = useCallback((question: SmartQuestion, opt: SmartQuestion["options"][0]) => {
    if (opt.action === "approve") resolveAssets(question.assetIds, "permitted", "تم تأكيده");
    else if (opt.action === "exclude") resolveAssets(question.assetIds, "not_permitted", "تم استبعاده");
    else if (opt.action === "update" && opt.updateField) {
      resolveAssets(question.assetIds, "permitted", `تم تحديث ${opt.updateField}`, { [opt.updateField]: opt.updateValue } as any);
    }
    advanceToNext(opt.label);
  }, [resolveAssets, advanceToNext]);

  const handleCustomSubmit = useCallback((question: SmartQuestion) => {
    if (!customValue.trim()) return;
    const val = customValue.trim();
    if (question.triggerType === "unclear_name") resolveAssets(question.assetIds, "permitted", "تم تصحيح الاسم", { name: val });
    else if (question.triggerType === "no_category") resolveAssets(question.assetIds, "permitted", "تم تحديد التصنيف", { category: val });
    else if (question.triggerType === "bad_quantity") { const qty = parseInt(val); if (qty > 0) resolveAssets(question.assetIds, "permitted", "تم تصحيح الكمية", { quantity: qty }); }
    advanceToNext(val);
  }, [customValue, resolveAssets, advanceToNext]);

  const handleFinalSubmit = (hasNotes: boolean) => {
    setMessages(prev => [...prev, { id: "final-a", type: "answer", text: hasNotes && additionalNotes.trim() ? additionalNotes.trim() : "لا يوجد", timestamp: Date.now() }]);
    setPhase("done");
    setTimeout(() => {
      setMessages(prev => [...prev, { id: "done-msg", type: "system", text: "✅ تم — يمكنك اعتماد الطلب الآن", timestamp: Date.now() }]);
    }, 200);
  };

  const handleApprove = () => onApprove(assets.filter(a => a.license_status === "permitted"), additionalNotes);
  const canSubmit = phase === "done" || (questions.length === 0 && phase === "final");
  const approvedCount = autoApproved.length;
  const activeQuestion = phase === "questions" && currentQIdx < questions.length ? questions[currentQIdx] : null;
  const isLastMessage = (msgId: string) => messages.length > 0 && messages[messages.length - 1].id === msgId;

  // Visible assets for table (first 10, expandable)
  const [showAll, setShowAll] = useState(false);
  const visibleAssets = showAll ? assets : assets.slice(0, 10);

  return (
    <div className="space-y-4">
      {/* ── 1. Summary Stats ── */}
      <div className="grid grid-cols-4 gap-2">
        <SummaryCard icon={<FileText className="w-4 h-4" />} label="ملفات" value={data.totalFiles} color="text-primary" />
        <SummaryCard icon={<Package className="w-4 h-4" />} label="أصول" value={assets.length} color="text-foreground" />
        <SummaryCard icon={<CheckCircle className="w-4 h-4" />} label="معالج" value={approvedCount} color="text-emerald-600" />
        <SummaryCard icon={<AlertCircle className="w-4 h-4" />} label="يحتاج توضيح" value={flagged.length} color="text-amber-600" />
      </div>

      {removedCount > 0 && (
        <p className="text-[10px] text-amber-600 text-center">تم دمج {removedCount} عنصر مكرر تلقائياً</p>
      )}

      {/* ── 2. Compact Assets Table ── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto max-h-[35vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-right text-[10px] w-8">#</TableHead>
                <TableHead className="text-right text-[10px]">الأصل</TableHead>
                <TableHead className="text-right text-[10px]">النوع</TableHead>
                <TableHead className="text-right text-[10px] w-12">الكمية</TableHead>
                <TableHead className="text-right text-[10px]">المصدر</TableHead>
                <TableHead className="text-right text-[10px] w-16">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleAssets.map((asset, idx) => (
                <TableRow
                  key={asset.id}
                  className={
                    asset.license_status === "needs_review"
                      ? "bg-amber-500/5"
                      : asset.license_status === "not_permitted"
                        ? "bg-destructive/5 opacity-60"
                        : ""
                  }
                >
                  <TableCell className="text-[10px] text-muted-foreground py-1.5">{idx + 1}</TableCell>
                  <TableCell className="py-1.5">
                    <span className="text-[11px] font-medium">{asset.name || "—"}</span>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span className="text-[10px] text-muted-foreground">{TYPE_LABELS[asset.category || asset.type] || asset.category || asset.type || "—"}</span>
                  </TableCell>
                  <TableCell className="text-[11px] py-1.5">{asset.quantity}</TableCell>
                  <TableCell className="py-1.5">
                    <button
                      onClick={() => asset.source_info && setSourceDetail(asset.source_info)}
                      className="text-[10px] text-muted-foreground hover:text-primary hover:underline flex items-center gap-0.5"
                      disabled={!asset.source_info}
                    >
                      {sourceLabel(asset.source_info)}
                      {asset.source_info && <Eye className="w-2.5 h-2.5 shrink-0" />}
                    </button>
                  </TableCell>
                  <TableCell className="py-1.5"><StatusBadge status={asset.license_status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {assets.length > 10 && !showAll && (
          <button onClick={() => setShowAll(true)} className="w-full py-2 text-[11px] text-primary hover:bg-primary/5 border-t border-border transition-colors">
            عرض الكل ({assets.length} أصل) ↓
          </button>
        )}
        {showAll && assets.length > 10 && (
          <button onClick={() => setShowAll(false)} className="w-full py-2 text-[11px] text-muted-foreground hover:bg-muted/30 border-t border-border transition-colors">
            إخفاء ↑
          </button>
        )}
      </Card>

      {/* ── 3. Raqeem Chat (ALWAYS visible) ── */}
      <Card className="border-primary/20">
          <CardContent className="p-0">
            {/* Chat header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-primary/5 rounded-t-lg">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold text-foreground">رقيم</span>
              {phase === "questions" && questions.length > 0 && (
                <span className="text-[9px] text-muted-foreground mr-auto">{currentQIdx + 1}/{questions.length}</span>
              )}
              {phase === "done" && (
                <Badge className="mr-auto bg-emerald-500/10 text-emerald-700 border-emerald-200 text-[9px]">✓ مكتمل</Badge>
              )}
            </div>

            {/* Messages */}
            <div className="px-4 py-3 space-y-3 max-h-[50vh] overflow-y-auto">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.type === "answer" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[92%] rounded-xl px-4 py-3 text-[13px] leading-[1.8] ${
                    msg.type === "system" ? "bg-primary/10 text-primary font-semibold"
                      : msg.type === "info" ? "bg-muted text-foreground"
                        : msg.type === "answer" ? "bg-card text-foreground border border-border shadow-sm"
                          : "bg-card text-foreground border border-border shadow-sm"
                  }`}>
                    <p className="whitespace-pre-line">{msg.text}</p>

                    {/* Action buttons for active question */}
                    {msg.type === "question" && msg.questionData && isLastMessage(msg.id) && activeQuestion && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {msg.questionData.options.map((opt, i) => (
                            <Button key={i} size="sm" variant={opt.action === "exclude" ? "destructive" : opt.action === "approve" ? "default" : "secondary"} className="h-6 text-[10px] rounded-full px-2.5" onClick={() => handleOptionClick(msg.questionData!, opt)}>
                              {opt.label}
                            </Button>
                          ))}
                        </div>
                        {msg.questionData.allowCustom && (
                          !showCustomInput ? (
                            <button onClick={() => setShowCustomInput(true)} className="text-[9px] text-primary hover:underline">+ إدخال ←</button>
                          ) : (
                            <div className="flex gap-1">
                              <Input value={customValue} onChange={e => setCustomValue(e.target.value)} placeholder={msg.questionData.customPlaceholder} className="h-6 text-[10px] flex-1" onKeyDown={e => { if (e.key === "Enter" && customValue.trim()) handleCustomSubmit(msg.questionData!); }} autoFocus />
                              <Button size="sm" className="h-6 text-[10px] px-1.5" disabled={!customValue.trim()} onClick={() => handleCustomSubmit(msg.questionData!)}><Send className="w-2.5 h-2.5" /></Button>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {/* Final question */}
                    {msg.id === "final-q" && phase === "final" && isLastMessage(msg.id) && (
                      <div className="mt-2 space-y-1.5">
                        <Textarea value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} placeholder="مثال: بعض المعدات متوقفة..." rows={2} className="text-[11px]" />
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="flex-1 text-[10px] h-6 rounded-full" onClick={() => handleFinalSubmit(false)}>لا يوجد</Button>
                          <Button size="sm" className="flex-1 text-[10px] h-6 rounded-full" onClick={() => handleFinalSubmit(true)} disabled={!additionalNotes.trim()}>إرسال</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="flex items-start gap-2 justify-end">
                  <div className="bg-muted rounded-xl px-4 py-3 max-w-[85%]">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Cog className="w-3.5 h-3.5 animate-spin" />
                      <span>رقيم يفكر...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Progress bar */}
            {phase === "questions" && questions.length > 0 && (
              <div className="px-3 pb-2">
                <div className="bg-muted rounded-full h-1">
                  <div className="bg-primary rounded-full h-1 transition-all duration-300" style={{ width: `${Math.round((currentQIdx / questions.length) * 100)}%` }} />
                </div>
              </div>
            )}

            {/* Free-text input bar */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-muted/20">
              <Input
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="اكتب سؤالك أو ملاحظتك لرقيم..."
                className="h-8 text-[12px] flex-1 bg-background"
                onKeyDown={e => { if (e.key === "Enter" && freeText.trim() && !isThinking) handleFreeTextSend(); }}
              />
              <Button size="sm" className="h-8 px-2.5 shrink-0" disabled={!freeText.trim() || isThinking} onClick={handleFreeTextSend}>
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

      {/* ── 4. Stats footer ── */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5 border border-border/30">
        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" />{approvedCount} جاهز</span>
        <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-destructive" />{excluded.length} مستبعد</span>
        <span className="flex items-center gap-1"><Package className="w-3 h-3" />{assets.length} إجمالي</span>
      </div>

      {/* ── 5. Submit ── */}
      <div className="space-y-2">
        <Button onClick={handleApprove} className="w-full gap-2" size="lg" disabled={!canSubmit || approvedCount === 0}>
          <FileCheck className="w-4 h-4" />
          اعتماد وإرسال ({approvedCount} أصل)
        </Button>
        <Button onClick={onBack} variant="outline" className="w-full gap-2" size="sm">
          <ArrowRight className="w-4 h-4" /> العودة لتعديل الملفات
        </Button>
        {approvedCount === 0 && phase === "done" && (
          <p className="text-[10px] text-destructive text-center">لا يوجد أصول معتمدة</p>
        )}
      </div>

      {/* ── Source Detail Dialog ── */}
      <Dialog open={!!sourceDetail} onOpenChange={() => setSourceDetail(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">تفاصيل المصدر</DialogTitle></DialogHeader>
          {sourceDetail && (
            <div className="space-y-2 text-sm">
              <Row label="الملف" value={sourceDetail.file_name} />
              <Row label="النوع" value={sourceDetail.file_type === "excel" ? "Excel" : sourceDetail.file_type === "pdf" ? "PDF" : sourceDetail.file_type === "image" ? "صورة" : "أخرى"} />
              {sourceDetail.sheet_name && <Row label="الشيت" value={sourceDetail.sheet_name} />}
              {sourceDetail.row_number && <Row label="الصف" value={`${sourceDetail.row_number}`} />}
              {sourceDetail.page_number && <Row label="الصفحة" value={`${sourceDetail.page_number}`} />}
              {sourceDetail.region && <Row label="المنطقة" value={sourceDetail.region} />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className="p-2.5 text-center">
      <div className={`flex items-center justify-center ${color} mb-1`}>{icon}</div>
      <p className="text-lg font-bold text-foreground leading-none">{value}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center border-b border-border/30 pb-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}
