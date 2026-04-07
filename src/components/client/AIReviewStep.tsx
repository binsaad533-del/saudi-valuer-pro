import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  CheckCircle, XCircle, Building2, Cog, Sparkles,
  Shield, ArrowRight, Package, FileCheck,
  FileText, Image, Table2, Eye, AlertOctagon, MessageCircleQuestion,
  ChevronLeft,
} from "lucide-react";

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
}

interface Props {
  data: AIReviewData;
  onApprove: (approved: ExtractedAsset[], notes: string) => void;
  onBack: () => void;
}

// ── Exclusion rules ──
const EXCLUSION_RULES: { keywords: string[]; reason: string }[] = [
  { keywords: ["intangible", "أصول غير ملموسة"], reason: "أصل غير ملموس — يتطلب تقييم مالي متخصص" },
  { keywords: ["goodwill", "شهرة"], reason: "شهرة محل — تتطلب تقييم أعمال متخصص" },
  { keywords: ["trademark", "علامة تجارية"], reason: "علامة تجارية — أصل غير ملموس" },
  { keywords: ["patent", "براءة اختراع"], reason: "براءة اختراع — أصل فكري" },
  { keywords: ["copyright"], reason: "حقوق ملكية فكرية — خارج نطاق الترخيص" },
  { keywords: ["software_license"], reason: "رخصة برمجية — أصل غير ملموس" },
  { keywords: ["financial_instrument", "stock", "bond", "derivative"], reason: "أداة مالية — تتطلب تقييم مالي متخصص" },
  { keywords: ["cryptocurrency"], reason: "عملة رقمية — غير مشمولة" },
];

// ── Smart verification triggers ──
type TriggerType = "low_confidence" | "unclear_name" | "no_category" | "bad_quantity" | "conflict";
type VerificationTrigger = { check: (a: ExtractedAsset) => boolean; reason: string; triggerType: TriggerType };

const VERIFICATION_TRIGGERS: VerificationTrigger[] = [
  { check: a => a.confidence < 35, reason: "ثقة منخفضة جداً", triggerType: "low_confidence" },
  { check: a => !a.name || a.name.trim().length < 3, reason: "اسم غير واضح", triggerType: "unclear_name" },
  { check: a => !a.category && !a.type, reason: "تصنيف غير محدد", triggerType: "no_category" },
  { check: a => a.quantity <= 0 || isNaN(a.quantity), reason: "كمية غير صحيحة", triggerType: "bad_quantity" },
  { check: a => {
    const name = (a.name || "").toLowerCase();
    const cat = (a.category || "").toLowerCase();
    const isNameProperty = ["أرض", "عقار", "مبنى", "فيلا", "شقة", "land", "building"].some(k => name.includes(k));
    const isCatMachinery = ["آلات", "معدات", "machinery", "equipment"].some(k => cat.includes(k));
    return isNameProperty && isCatMachinery;
  }, reason: "تعارض بين الاسم والتصنيف", triggerType: "conflict" },
];

const ASSET_TYPE_MAP: Record<string, { label: string; icon: typeof Building2 }> = {
  real_estate: { label: "عقار", icon: Building2 },
  machinery_equipment: { label: "آلات ومعدات", icon: Cog },
  both: { label: "عقار + آلات ومعدات", icon: Sparkles },
};

const FILE_TYPE_ICONS: Record<string, typeof FileText> = {
  excel: Table2, pdf: FileText, image: Image, unknown: FileText,
};

// ── Smart Question generator ──
interface SmartQuestion {
  assetId: number;
  question: string;
  options: { label: string; action: "approve" | "exclude" | "update"; updateField?: string; updateValue?: string }[];
  allowCustom: boolean;
  customPlaceholder?: string;
}

function generateSmartQuestion(asset: ExtractedAsset, triggerType: TriggerType): SmartQuestion {
  const base = { assetId: asset.id, allowCustom: false } as SmartQuestion;

  switch (triggerType) {
    case "unclear_name":
      return {
        ...base,
        question: `ما هو الاسم الصحيح لهذا البند؟ (الحالي: "${asset.name || "—"}")`,
        options: [
          { label: "استبعاد هذا البند", action: "exclude" },
        ],
        allowCustom: true,
        customPlaceholder: "اكتب الاسم الصحيح...",
      };

    case "no_category":
      return {
        ...base,
        question: `ما تصنيف "${asset.name}"؟`,
        options: [
          { label: "عقار", action: "update", updateField: "category", updateValue: "real_estate" },
          { label: "آلات ومعدات", action: "update", updateField: "category", updateValue: "machinery_equipment" },
          { label: "أثاث ومفروشات", action: "update", updateField: "category", updateValue: "furniture" },
          { label: "استبعاد — ليس أصلاً", action: "exclude" },
        ],
        allowCustom: true,
        customPlaceholder: "تصنيف آخر...",
      };

    case "bad_quantity":
      return {
        ...base,
        question: `الكمية لـ "${asset.name}" غير صحيحة (${asset.quantity}). ما الكمية الفعلية؟`,
        options: [
          { label: "1", action: "update", updateField: "quantity", updateValue: "1" },
          { label: "استبعاد", action: "exclude" },
        ],
        allowCustom: true,
        customPlaceholder: "أدخل الكمية...",
      };

    case "conflict":
      return {
        ...base,
        question: `"${asset.name}" مصنف كـ "${asset.category}" — هل هذا صحيح؟`,
        options: [
          { label: "نعم، التصنيف صحيح", action: "approve" },
          { label: "عقار", action: "update", updateField: "category", updateValue: "real_estate" },
          { label: "آلات ومعدات", action: "update", updateField: "category", updateValue: "machinery_equipment" },
          { label: "استبعاد", action: "exclude" },
        ],
        allowCustom: false,
      };

    case "low_confidence":
    default:
      return {
        ...base,
        question: `"${asset.name}" — ثقة الاستخراج منخفضة (${asset.confidence}%). هل تريد تضمينه؟`,
        options: [
          { label: "نعم، تضمينه كأصل", action: "approve" },
          { label: "لا، استبعاده", action: "exclude" },
        ],
        allowCustom: false,
      };
  }
}

function detectTriggerType(asset: ExtractedAsset): TriggerType {
  for (const t of VERIFICATION_TRIGGERS) {
    if (t.check(asset)) return t.triggerType;
  }
  return "low_confidence";
}

// ── Classification ──
export function classifyAssetLicense(asset: ExtractedAsset): ExtractedAsset {
  const combined = `${(asset.category || asset.type || "").toLowerCase()} ${(asset.name || "").toLowerCase()}`;
  for (const rule of EXCLUSION_RULES) {
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

// ── Deduplication ──
function deduplicateAssets(assets: ExtractedAsset[]) {
  const seen = new Map<string, ExtractedAsset>();
  for (const asset of assets) {
    const key = `${(asset.name || "").trim().toLowerCase()}|${(asset.category || "").toLowerCase()}|${(asset.source || "").toLowerCase()}`;
    const existing = seen.get(key);
    if (existing) {
      existing.quantity += asset.quantity;
      if (asset.confidence > existing.confidence) existing.confidence = asset.confidence;
    } else {
      seen.set(key, { ...asset });
    }
  }
  const unique = Array.from(seen.values());
  return { unique, removedCount: assets.length - unique.length };
}

// ══════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════
export default function AIReviewStep({ data, onApprove, onBack }: Props) {
  const { processed, removedCount } = useMemo(() => {
    const { unique, removedCount } = deduplicateAssets(data.assets);
    const processed = unique.map(a => {
      if (a.license_status === "not_permitted" && a.license_reason) return a;
      return classifyAssetLicense(a);
    });
    return { processed, removedCount };
  }, [data.assets]);

  const [assets, setAssets] = useState<ExtractedAsset[]>(processed);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [sourcePreviewAsset, setSourcePreviewAsset] = useState<ExtractedAsset | null>(null);
  const [showFinalQuestion, setShowFinalQuestion] = useState(false);

  const autoApproved = useMemo(() => assets.filter(a => a.license_status === "permitted"), [assets]);
  const flagged = useMemo(() => assets.filter(a => a.license_status === "needs_review"), [assets]);
  const excluded = useMemo(() => assets.filter(a => a.license_status === "not_permitted"), [assets]);

  // Current question = first flagged item
  const currentFlagged = flagged.length > 0 ? flagged[0] : null;
  const currentQuestion = currentFlagged ? generateSmartQuestion(currentFlagged, detectTriggerType(currentFlagged)) : null;

  const typeInfo = ASSET_TYPE_MAP[data.confirmedType];
  const TypeIcon = typeInfo?.icon || Sparkles;
  const canSubmit = autoApproved.length > 0 && flagged.length === 0;

  // All questions answered, show final question
  const allResolved = flagged.length === 0 && !showFinalQuestion && assets.some(a => a.license_status === "permitted");

  const resolveAsset = useCallback((id: number, status: "permitted" | "not_permitted", reason: string, updates?: Partial<ExtractedAsset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates, license_status: status, license_reason: reason } : a));
  }, []);

  const handleQuestionAnswer = useCallback((assetId: number, option: SmartQuestion["options"][0]) => {
    if (option.action === "approve") {
      resolveAsset(assetId, "permitted", "تم تأكيده من العميل");
    } else if (option.action === "exclude") {
      resolveAsset(assetId, "not_permitted", "تم استبعاده من العميل");
    } else if (option.action === "update" && option.updateField) {
      const updates: any = { [option.updateField]: option.updateValue };
      resolveAsset(assetId, "permitted", `تم تحديث ${option.updateField}`, updates);
    }
  }, [resolveAsset]);

  const handleCustomAnswer = useCallback((assetId: number, triggerType: TriggerType, value: string) => {
    if (!value.trim()) return;
    if (triggerType === "unclear_name") {
      resolveAsset(assetId, "permitted", "تم تصحيح الاسم", { name: value.trim() });
    } else if (triggerType === "no_category") {
      resolveAsset(assetId, "permitted", "تم تحديد التصنيف", { category: value.trim() });
    } else if (triggerType === "bad_quantity") {
      const qty = parseInt(value);
      if (qty > 0) resolveAsset(assetId, "permitted", "تم تصحيح الكمية", { quantity: qty });
    }
  }, [resolveAsset]);

  const handleApprove = () => onApprove(assets.filter(a => a.license_status === "permitted"), additionalNotes);

  // Auto-trigger final question when all resolved
  const shouldShowFinal = allResolved && !showFinalQuestion;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Source Preview Dialog */}
        <Dialog open={!!sourcePreviewAsset} onOpenChange={() => setSourcePreviewAsset(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm">مصدر البند — {sourcePreviewAsset?.name}</DialogTitle>
            </DialogHeader>
            {sourcePreviewAsset && <SourcePreview asset={sourcePreviewAsset} />}
          </DialogContent>
        </Dialog>

        {/* ── Summary Header ── */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <TypeIcon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-foreground">نتيجة التحليل الذكي</h3>
                  <Badge variant="default" className="text-[10px]">ثقة {data.confidence}%</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {typeInfo?.label || data.confirmedType} — {data.totalFiles} ملف — {assets.length} عنصر
                  {removedCount > 0 && <span className="text-amber-600"> (أُزيل {removedCount} مكرر)</span>}
                </p>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
              <QuickStat icon={<CheckCircle className="w-3.5 h-3.5 text-emerald-600" />} value={autoApproved.length} label="جاهز" color="text-emerald-600" />
              <QuickStat icon={<MessageCircleQuestion className="w-3.5 h-3.5 text-amber-500" />} value={flagged.length} label="بانتظارك" color="text-amber-500" />
              <QuickStat icon={<Shield className="w-3.5 h-3.5 text-destructive" />} value={excluded.length} label="مستبعد" color="text-destructive" />
            </div>

            {/* Status */}
            {flagged.length === 0 ? (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg p-2.5 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400">تم — جميع البنود جاهزة</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-2.5 border border-amber-200 dark:border-amber-800">
                <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>{flagged.length}</strong> سؤال بسيط قبل المتابعة
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Smart Question (one at a time) ── */}
        {currentFlagged && currentQuestion && (
          <SmartQuestionCard
            asset={currentFlagged}
            question={currentQuestion}
            triggerType={detectTriggerType(currentFlagged)}
            remainingCount={flagged.length}
            onAnswer={(opt) => handleQuestionAnswer(currentFlagged.id, opt)}
            onCustomAnswer={(val) => handleCustomAnswer(currentFlagged.id, detectTriggerType(currentFlagged), val)}
            onViewSource={() => setSourcePreviewAsset(currentFlagged)}
          />
        )}

        {/* ── Final Question (after all resolved) ── */}
        {shouldShowFinal && (
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircleQuestion className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold text-foreground">سؤال أخير</p>
              </div>
              <p className="text-sm text-foreground">هل ترغب بإضافة أي معلومات مهمة قد تؤثر على التقييم؟</p>
              <Textarea
                value={additionalNotes}
                onChange={e => setAdditionalNotes(e.target.value)}
                placeholder="مثال: بعض المعدات متوقفة عن العمل، أو يوجد رهن على العقار..."
                rows={2}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setShowFinalQuestion(true)}>
                  لا، متابعة بدون إضافة
                </Button>
                <Button size="sm" className="flex-1 text-xs" onClick={() => setShowFinalQuestion(true)} disabled={!additionalNotes.trim()}>
                  حفظ والمتابعة
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Auto-approved (collapsed) ── */}
        {autoApproved.length > 0 && (
          <CollapsibleSection
            icon={<CheckCircle className="w-4 h-4 text-emerald-600" />}
            title="بنود جاهزة للتقييم"
            count={autoApproved.length}
            borderClass="border-emerald-200 dark:border-emerald-800"
          >
            {autoApproved.map(a => (
              <div key={a.id} className="flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg px-2.5 py-1.5 border border-border/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <p className="text-[11px] text-foreground flex-1 truncate">{a.name}</p>
                {a.quantity > 1 && <span className="text-[9px] text-muted-foreground">×{a.quantity}</span>}
                {a.category && <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">{a.category}</span>}
              </div>
            ))}
          </CollapsibleSection>
        )}

        {/* ── Excluded (collapsed) ── */}
        {excluded.length > 0 && (
          <CollapsibleSection
            icon={<Shield className="w-4 h-4 text-destructive" />}
            title="بنود مستبعدة"
            count={excluded.length}
            borderClass="border-destructive/20"
          >
            {excluded.map(a => (
              <div key={a.id} className="flex items-center gap-2 bg-destructive/5 rounded-lg px-2.5 py-1.5 border border-border/20">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-foreground truncate">{a.name}</p>
                  {a.license_reason && <p className="text-[9px] text-muted-foreground">{a.license_reason}</p>}
                </div>
              </div>
            ))}
          </CollapsibleSection>
        )}

        {assets.length === 0 && (
          <div className="text-center py-8">
            <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لم يتم استخراج أي أصول</p>
          </div>
        )}

        {/* ── Submit ── */}
        <div className="space-y-2">
          <Button onClick={handleApprove} className="w-full gap-2" size="lg" disabled={!canSubmit && !showFinalQuestion}>
            <FileCheck className="w-4 h-4" />
            اعتماد وإرسال الطلب ({autoApproved.length} أصل)
          </Button>
          <Button onClick={onBack} variant="outline" className="w-full gap-2" size="sm">
            <ArrowRight className="w-4 h-4" /> العودة لتعديل الملفات
          </Button>
          {autoApproved.length === 0 && flagged.length === 0 && (
            <p className="text-[10px] text-destructive text-center">لا يوجد أصول معتمدة</p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ── Smart Question Card ──
function SmartQuestionCard({ question, remainingCount, onAnswer, onCustomAnswer, onViewSource }: {
  question: SmartQuestion;
  remainingCount: number;
  onAnswer: (opt: SmartQuestion["options"][0]) => void;
  onCustomAnswer: (val: string) => void;
  onViewSource: () => void;
}) {
  const [customValue, setCustomValue] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-900/5">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="w-4 h-4 text-amber-600" />
            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
              سؤال {remainingCount > 1 ? `(${remainingCount} متبقي)` : "(أخير)"}
            </span>
          </div>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-muted-foreground" onClick={onViewSource}>
            <Eye className="w-3 h-3" /> المصدر
          </Button>
        </div>

        {/* Question */}
        <p className="text-sm font-semibold text-foreground leading-relaxed">{question.question}</p>

        {/* Options */}
        <div className="flex flex-wrap gap-2">
          {question.options.map((opt, i) => (
            <Button
              key={i}
              size="sm"
              variant={opt.action === "exclude" ? "destructive" : opt.action === "approve" ? "default" : "secondary"}
              className="h-8 text-xs gap-1"
              onClick={() => onAnswer(opt)}
            >
              {opt.action === "exclude" && <XCircle className="w-3 h-3" />}
              {opt.action === "approve" && <CheckCircle className="w-3 h-3" />}
              {opt.label}
            </Button>
          ))}
        </div>

        {/* Custom input */}
        {question.allowCustom && (
          <>
            {!showCustom ? (
              <button
                onClick={() => setShowCustom(true)}
                className="text-[10px] text-primary hover:underline"
              >
                إدخال إجابة مخصصة ←
              </button>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={customValue}
                  onChange={e => setCustomValue(e.target.value)}
                  placeholder={question.customPlaceholder}
                  className="h-8 text-xs flex-1"
                  onKeyDown={e => { if (e.key === "Enter" && customValue.trim()) onCustomAnswer(customValue); }}
                />
                <Button size="sm" className="h-8 text-xs" disabled={!customValue.trim()} onClick={() => onCustomAnswer(customValue)}>
                  تأكيد
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Collapsible Section ──
function CollapsibleSection({ icon, title, count, borderClass, children }: {
  icon: React.ReactNode; title: string; count: number; borderClass: string; children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className={borderClass}>
      <button onClick={() => setExpanded(!expanded)} className="w-full p-3 flex items-center gap-2 text-right">
        {icon}
        <span className="text-xs font-semibold text-foreground flex-1">{title}</span>
        <Badge variant="secondary" className="text-[10px]">{count}</Badge>
        <ChevronLeft className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expanded ? "-rotate-90" : ""}`} />
      </button>
      {expanded && <div className="px-3 pb-3 space-y-1">{children}</div>}
    </Card>
  );
}

// ── Source Preview ──
function SourcePreview({ asset }: { asset: ExtractedAsset }) {
  const info = asset.source_info;
  const fileType = info?.file_type || (asset.source?.toLowerCase().includes("excel") ? "excel" : asset.source?.toLowerCase().includes("pdf") ? "pdf" : asset.source?.toLowerCase().includes("image") || asset.source?.toLowerCase().includes("صور") ? "image" : "unknown");
  const Icon = FILE_TYPE_ICONS[fileType] || FileText;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
        <Icon className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <p className="text-xs font-medium text-foreground">{info?.file_name || asset.source || "غير معروف"}</p>
          <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
            <span>نوع: {fileType === "excel" ? "Excel" : fileType === "pdf" ? "PDF" : fileType === "image" ? "صورة" : "غير محدد"}</span>
            {info?.sheet_name && <span>شيت: {info.sheet_name}</span>}
            {info?.row_number && <span>صف: {info.row_number}</span>}
            {info?.page_number && <span>صفحة: {info.page_number}</span>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted/20 rounded p-2"><span className="text-muted-foreground">الاسم:</span> <strong>{asset.name}</strong></div>
        <div className="bg-muted/20 rounded p-2"><span className="text-muted-foreground">النوع:</span> <strong>{asset.type || "—"}</strong></div>
        <div className="bg-muted/20 rounded p-2"><span className="text-muted-foreground">الكمية:</span> <strong>{asset.quantity}</strong></div>
        <div className="bg-muted/20 rounded p-2"><span className="text-muted-foreground">الفئة:</span> <strong>{asset.category || "—"}</strong></div>
      </div>
    </div>
  );
}

// ── Quick Stat ──
function QuickStat({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className="bg-background rounded-lg p-2 text-center border border-border/50">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {icon}
        <span className={`text-lg font-bold ${color}`}>{value}</span>
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
