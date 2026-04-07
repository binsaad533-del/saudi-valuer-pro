import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle, XCircle, AlertTriangle, Building2, Cog, Sparkles,
  Shield, Trash2, Edit3, ArrowRight, Package, Ban,
  HelpCircle, FileCheck, ChevronDown, ChevronUp, Layers, BarChart3,
  CheckCheck, XOctagon, Eye, Filter, Info, FileText, Image, Table2,
  Lightbulb, ListChecks, ChevronLeft, ChevronRight, Pencil,
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

// ── Constants ──
const EXCLUSION_RULES: { keywords: string[]; reason: string }[] = [
  { keywords: ["intangible", "أصول غير ملموسة"], reason: "أصل غير ملموس — يتطلب تقييم مالي متخصص خارج نطاق الترخيص" },
  { keywords: ["goodwill", "شهرة"], reason: "شهرة محل — تتطلب تقييم أعمال متخصص (Business Valuation)" },
  { keywords: ["trademark", "علامة تجارية"], reason: "علامة تجارية — تصنف كأصل غير ملموس خارج نطاق التقييم العقاري والمعدات" },
  { keywords: ["patent", "براءة اختراع"], reason: "براءة اختراع — أصل فكري يتطلب تقييم IP متخصص" },
  { keywords: ["copyright"], reason: "حقوق ملكية فكرية — خارج نطاق الترخيص الحالي" },
  { keywords: ["software_license"], reason: "رخصة برمجية — أصل غير ملموس لا يدخل ضمن التقييم" },
  { keywords: ["financial_instrument", "stock", "bond", "derivative"], reason: "أداة مالية — تتطلب تقييم مالي متخصص وليست ضمن نطاق الترخيص" },
  { keywords: ["cryptocurrency"], reason: "عملة رقمية — غير مشمولة ضمن التقييم العقاري أو المعدات" },
];

const REVIEW_REASONS: { check: (a: ExtractedAsset) => boolean; reason: string }[] = [
  { check: a => a.confidence < 40, reason: "ثقة الاستخراج منخفضة — البيانات قد تكون غير دقيقة" },
  { check: a => !a.name || a.name.trim().length < 3, reason: "اسم الأصل غير واضح أو قصير جداً" },
  { check: a => !a.category && !a.type, reason: "تصنيف الأصل غير محدد — لم يتمكن النظام من تحديد الفئة" },
  { check: a => (a.source || "").toLowerCase().includes("excel") || (a.source || "").toLowerCase().includes("csv"), reason: "مصدر Excel — يحتاج مراجعة يدوية للتأكد من صحة البيانات" },
  { check: a => a.quantity <= 0 || isNaN(a.quantity), reason: "الكمية غير صحيحة أو مفقودة" },
];

const PERMITTED_CATEGORIES = [
  "real_estate", "land", "building", "villa", "apartment", "commercial_property",
  "machinery_equipment", "machinery", "equipment", "vehicle", "furniture", "electronics",
  "عقار", "أرض", "مبنى", "فيلا", "شقة", "عقار تجاري", "آلات", "معدات", "مركبات", "أثاث",
];

const ASSET_TYPE_MAP: Record<string, { label: string; icon: typeof Building2 }> = {
  real_estate: { label: "عقار", icon: Building2 },
  machinery_equipment: { label: "آلات ومعدات", icon: Cog },
  both: { label: "عقار + آلات ومعدات", icon: Sparkles },
};

const STATUS_TOOLTIPS: Record<string, string> = {
  permitted: "يمكن تقييم هذا الأصل ضمن نطاق الترخيص الحالي",
  needs_review: "يتطلب قرار بشري قبل اعتماده — يرجى مراجعة السبب والمصدر",
  not_permitted: "لا يمكن تقييم هذا الأصل ضمن نطاق الترخيص الحالي",
};

const RECLASSIFY_OPTIONS = [
  { value: "real_estate", label: "عقار" },
  { value: "machinery_equipment", label: "آلات ومعدات" },
  { value: "expense", label: "مصروف — ليس أصلاً" },
  { value: "not_asset", label: "غير أصل — استبعاد" },
];

const FILE_TYPE_ICONS: Record<string, typeof FileText> = {
  excel: Table2, pdf: FileText, image: Image, unknown: FileText,
};

function getAiSuggestion(asset: ExtractedAsset): string {
  if (asset.ai_suggestion) return asset.ai_suggestion;
  const combined = `${asset.category || ""} ${asset.type || ""} ${asset.name || ""}`.toLowerCase();
  if (["expense", "مصروف", "consumable", "مستهلك"].some(k => combined.includes(k))) return "يبدو أنه مصروف وليس أصلاً ثابتاً";
  if (["land", "أرض", "building", "مبنى", "villa", "فيلا"].some(k => combined.includes(k))) return "يبدو أنه أصل عقاري";
  if (["machinery", "equipment", "معدات", "آلات", "machine"].some(k => combined.includes(k))) return "يبدو أنه معدة / آلة";
  if (asset.confidence >= 70) return "أصل ثابت — ثقة عالية";
  return "تصنيف غير مؤكد — يحتاج مراجعة يدوية";
}

// ── Classification ──
export function classifyAssetLicense(asset: ExtractedAsset): ExtractedAsset {
  const cat = (asset.category || asset.type || "").toLowerCase();
  const name = (asset.name || "").toLowerCase();
  const combined = `${cat} ${name}`;
  for (const rule of EXCLUSION_RULES) {
    if (rule.keywords.some(k => combined.includes(k.toLowerCase()))) {
      return { ...asset, license_status: "not_permitted", license_reason: rule.reason };
    }
  }
  if (PERMITTED_CATEGORIES.some(k => combined.includes(k.toLowerCase()))) {
    return { ...asset, license_status: "permitted", license_reason: "مشمول ضمن نطاق الترخيص" };
  }
  for (const rule of REVIEW_REASONS) {
    if (rule.check(asset)) {
      return { ...asset, license_status: "needs_review", license_reason: rule.reason };
    }
  }
  return { ...asset, license_status: "needs_review", license_reason: "تصنيف غير مؤكد — يحتاج تأكيد العميل" };
}

// ── Helpers ──
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

function getConfidenceStats(assets: ExtractedAsset[]) {
  if (assets.length === 0) return { avg: 0, min: 0, max: 0 };
  const vals = assets.map(a => a.confidence);
  return { avg: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length), min: Math.min(...vals), max: Math.max(...vals) };
}

function groupByCategory(assets: ExtractedAsset[]) {
  const groups: Record<string, ExtractedAsset[]> = {};
  for (const a of assets) {
    const cat = a.category || a.type || "غير مصنف";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(a);
  }
  return groups;
}

const SAMPLE_SIZE = 10;
const LAZY_PAGE_SIZE = 50;
const LARGE_DATASET_THRESHOLD = 200;
type FilterMode = "all" | "permitted" | "needs_review" | "not_permitted";

export default function AIReviewStep({ data, onApprove, onBack }: Props) {
  const { deduplicated, removedCount } = useMemo(() => {
    const { unique, removedCount } = deduplicateAssets(data.assets);
    const processed = unique.map(a => {
      const isExcel = (a.source || "").toLowerCase().includes("excel") || (a.source || "").toLowerCase().includes("csv");
      if (isExcel && a.license_status === "permitted") {
        return { ...a, license_status: "needs_review" as const, license_reason: "مصدر Excel — يحتاج مراجعة يدوية للتأكد من صحة البيانات" };
      }
      if (!a.license_reason || a.license_reason === "يحتاج تأكيد العميل" || a.license_reason === "خارج نطاق الترخيص الحالي") {
        return classifyAssetLicense(a);
      }
      return a;
    });
    return { deduplicated: processed, removedCount };
  }, [data.assets]);

  const [assets, setAssets] = useState<ExtractedAsset[]>(deduplicated);
  const [reviewNotes, setReviewNotes] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ permitted: true, not_permitted: true, needs_review: true });
  const [showAllItems, setShowAllItems] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LAZY_PAGE_SIZE);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  // Source viewed tracking
  const [viewedSources, setViewedSources] = useState<Set<number>>(new Set());
  const [sourcePreviewAsset, setSourcePreviewAsset] = useState<ExtractedAsset | null>(null);

  // Step-by-step review mode
  const [stepMode, setStepMode] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Reclassify state
  const [reclassifyingId, setReclassifyingId] = useState<number | null>(null);

  const permitted = useMemo(() => assets.filter(a => a.license_status === "permitted"), [assets]);
  const notPermitted = useMemo(() => assets.filter(a => a.license_status === "not_permitted"), [assets]);
  const needsReview = useMemo(() => assets.filter(a => a.license_status === "needs_review"), [assets]);
  const confidenceStats = useMemo(() => getConfidenceStats(assets), [assets]);
  const categoryGroups = useMemo(() => groupByCategory(assets), [assets]);

  const typeInfo = ASSET_TYPE_MAP[data.confirmedType];
  const TypeIcon = typeInfo?.icon || Sparkles;
  const isLargeDataset = assets.length > LARGE_DATASET_THRESHOLD;

  // Review progress
  const reviewedCount = useMemo(() => {
    return deduplicated.filter(orig => {
      const current = assets.find(a => a.id === orig.id);
      return !current || current.license_status !== "needs_review";
    }).length;
  }, [assets, deduplicated]);
  const totalReviewable = deduplicated.filter(a => a.license_status === "needs_review").length;

  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const removeAsset = useCallback((id: number) => setAssets(prev => prev.filter(a => a.id !== id)), []);

  const markSourceViewed = useCallback((id: number) => {
    setViewedSources(prev => new Set(prev).add(id));
  }, []);

  const openSourcePreview = useCallback((asset: ExtractedAsset) => {
    markSourceViewed(asset.id);
    setSourcePreviewAsset(asset);
  }, [markSourceViewed]);

  const approveAsset = useCallback((id: number) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, license_status: "permitted" as const, license_reason: "تم تأكيده من العميل" } : a));
  }, []);

  const rejectAsset = useCallback((id: number) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, license_status: "not_permitted" as const, license_reason: "تم رفضه من العميل" } : a));
  }, []);

  const reclassifyAsset = useCallback((id: number, newType: string) => {
    setAssets(prev => prev.map(a => {
      if (a.id !== id) return a;
      if (newType === "expense" || newType === "not_asset") {
        return { ...a, license_status: "not_permitted" as const, type: newType, license_reason: newType === "expense" ? "أعيد تصنيفه كمصروف من العميل" : "أعيد تصنيفه كغير أصل من العميل" };
      }
      return { ...a, license_status: "permitted" as const, type: newType, license_reason: `أعيد تصنيفه كـ ${RECLASSIFY_OPTIONS.find(o => o.value === newType)?.label || newType} من العميل` };
    }));
    setReclassifyingId(null);
  }, []);

  const bulkApproveAll = useCallback(() => {
    setAssets(prev => prev.map(a => a.license_status === "needs_review" ? { ...a, license_status: "permitted" as const, license_reason: "اعتماد جماعي من العميل" } : a));
  }, []);

  const bulkRejectAll = useCallback(() => {
    setAssets(prev => prev.map(a => a.license_status === "needs_review" ? { ...a, license_status: "not_permitted" as const, license_reason: "استبعاد جماعي من العميل" } : a));
  }, []);

  const bulkApproveCategory = useCallback((category: string) => {
    setAssets(prev => prev.map(a => {
      const cat = a.category || a.type || "غير مصنف";
      return cat === category && a.license_status === "needs_review" ? { ...a, license_status: "permitted" as const, license_reason: "اعتماد حسب الفئة من العميل" } : a;
    }));
  }, []);

  const handleApprove = () => onApprove(assets.filter(a => a.license_status === "permitted"), reviewNotes);

  const permittedCount = permitted.length;
  const canSubmit = permittedCount > 0;
  const getVisibleAssets = (list: ExtractedAsset[]) => {
    if (showAllItems || list.length <= SAMPLE_SIZE) return list.slice(0, visibleCount);
    return list.slice(0, SAMPLE_SIZE);
  };
  const loadMore = () => setVisibleCount(prev => prev + LAZY_PAGE_SIZE);

  const showPermitted = filterMode === "all" || filterMode === "permitted";
  const showNeedsReview = filterMode === "all" || filterMode === "needs_review";
  const showNotPermitted = filterMode === "all" || filterMode === "not_permitted";

  // Step-by-step review
  const stepAsset = needsReview[stepIndex];
  const handleStepDecision = (decision: "approve" | "reject") => {
    if (!stepAsset) return;
    if (decision === "approve") approveAsset(stepAsset.id);
    else rejectAsset(stepAsset.id);
    // Auto-advance
    if (stepIndex < needsReview.length - 1) setStepIndex(prev => prev + 1);
    else setStepMode(false);
  };

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* Source Preview Dialog */}
        <Dialog open={!!sourcePreviewAsset} onOpenChange={() => setSourcePreviewAsset(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm">عرض المصدر — {sourcePreviewAsset?.name}</DialogTitle>
            </DialogHeader>
            {sourcePreviewAsset && <SourcePreviewContent asset={sourcePreviewAsset} />}
          </DialogContent>
        </Dialog>

        {/* Step-by-step review mode */}
        {stepMode && stepAsset ? (
          <StepByStepReview
            asset={stepAsset}
            index={stepIndex}
            total={needsReview.length}
            reviewed={totalReviewable - needsReview.length}
            onApprove={() => handleStepDecision("approve")}
            onReject={() => handleStepDecision("reject")}
            onViewSource={() => openSourcePreview(stepAsset)}
            onReclassify={(type) => reclassifyAsset(stepAsset.id, type)}
            onPrev={() => setStepIndex(i => Math.max(0, i - 1))}
            onNext={() => setStepIndex(i => Math.min(needsReview.length - 1, i + 1))}
            onExit={() => setStepMode(false)}
            sourceViewed={viewedSources.has(stepAsset.id)}
          />
        ) : (
          <>
            {/* Header summary */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <TypeIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-foreground">نتيجة التحليل الذكي</h3>
                      <Badge variant="default" className="text-[10px]">ثقة {data.confidence}%</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      نوع الأصل: {typeInfo?.label || data.confirmedType} — {data.totalFiles} ملف — {assets.length} عنصر
                      {removedCount > 0 && <span className="text-amber-600"> (تم إزالة {removedCount} مكرر)</span>}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <StatBox icon={<CheckCircle className="w-3.5 h-3.5 text-emerald-600" />} value={permitted.length} label="مشمول" color="text-emerald-600" />
                  <StatBox icon={<Ban className="w-3.5 h-3.5 text-destructive" />} value={notPermitted.length} label="غير مشمول" color="text-destructive" />
                  <StatBox icon={<HelpCircle className="w-3.5 h-3.5 text-amber-500" />} value={needsReview.length} label="يحتاج مراجعة" color="text-amber-500" />
                </div>

                <div className="flex items-center gap-3 bg-background rounded-lg p-2 border border-border/50">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <div className="flex gap-4 text-[10px]">
                    <span>متوسط الثقة: <strong className="text-foreground">{confidenceStats.avg}%</strong></span>
                    <span>أدنى: <strong className="text-destructive">{confidenceStats.min}%</strong></span>
                    <span>أعلى: <strong className="text-emerald-600">{confidenceStats.max}%</strong></span>
                  </div>
                </div>

                {/* Review progress bar */}
                {totalReviewable > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>تقدم المراجعة</span>
                      <span>{reviewedCount} من {totalReviewable} عنصر</span>
                    </div>
                    <Progress value={totalReviewable > 0 ? (reviewedCount / totalReviewable) * 100 : 0} className="h-1.5" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Large dataset warning */}
            {isLargeDataset && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700">عدد الأصول كبير ({assets.length} عنصر)</p>
                  <p className="text-[10px] text-amber-600/80 mt-0.5">ننصح بمراجعة عينة قبل الاعتماد.</p>
                </div>
              </div>
            )}

            {/* Step-by-step mode trigger + filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {needsReview.length > 0 && (
                <Button size="sm" variant="secondary" className="h-7 text-[10px] gap-1" onClick={() => { setStepMode(true); setStepIndex(0); }}>
                  <ListChecks className="w-3 h-3" /> مراجعة العناصر واحداً تلو الآخر
                </Button>
              )}
              <div className="flex-1" />
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              {([
                { key: "all" as FilterMode, label: "الكل", count: assets.length },
                { key: "needs_review" as FilterMode, label: "مراجعة", count: needsReview.length },
                { key: "permitted" as FilterMode, label: "مشمول", count: permitted.length },
                { key: "not_permitted" as FilterMode, label: "مستبعد", count: notPermitted.length },
              ]).map(f => (
                <Button key={f.key} size="sm" variant={filterMode === f.key ? "default" : "outline"} className="h-6 text-[10px] gap-1 px-2" onClick={() => setFilterMode(f.key)}>
                  {f.label} ({f.count})
                </Button>
              ))}
            </div>

            {/* Category Grouping */}
            {Object.keys(categoryGroups).length > 1 && (
              <Card>
                <button onClick={() => toggleSection("groups")} className="w-full p-3 flex items-center gap-2 text-right">
                  <Layers className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground flex-1">التصنيف حسب الفئة</span>
                  <Badge variant="secondary" className="text-[10px]">{Object.keys(categoryGroups).length} فئة</Badge>
                  {expandedSections.groups ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                {expandedSections.groups && (
                  <div className="px-3 pb-3 space-y-1.5">
                    {Object.entries(categoryGroups).map(([cat, items]) => {
                      const reviewCount = items.filter(i => i.license_status === "needs_review").length;
                      return (
                        <div key={cat} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                          <span className="text-xs font-medium text-foreground flex-1">{cat}</span>
                          <Badge variant="secondary" className="text-[10px]">{items.length} عنصر</Badge>
                          {reviewCount > 0 && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => bulkApproveCategory(cat)}>
                              <CheckCheck className="w-3 h-3" /> اعتماد الفئة
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}

            {/* Not permitted warning */}
            {notPermitted.length > 0 && showNotPermitted && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <Shield className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-destructive">بعض العناصر ليست ضمن نطاق الترخيص</p>
                  <p className="text-[10px] text-destructive/80 mt-0.5">ستُستبعد تلقائياً من طلب التقييم.</p>
                </div>
              </div>
            )}

            {/* Bulk actions */}
            {needsReview.length > 0 && showNeedsReview && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-muted-foreground">إجراءات جماعية:</span>
                <Button size="sm" variant="default" className="h-7 text-[10px] gap-1" onClick={bulkApproveAll}>
                  <CheckCheck className="w-3 h-3" /> اعتماد الكل ({needsReview.length})
                </Button>
                <Button size="sm" variant="destructive" className="h-7 text-[10px] gap-1" onClick={bulkRejectAll}>
                  <XOctagon className="w-3 h-3" /> استبعاد الكل
                </Button>
              </div>
            )}

            {/* Needs Review section */}
            {needsReview.length > 0 && showNeedsReview && (
              <AssetSection title="عناصر تحتاج مراجعة العميل" icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} count={needsReview.length} variant="warning" expanded={expandedSections.needs_review} onToggle={() => toggleSection("needs_review")}>
                {getVisibleAssets(needsReview).map(asset => (
                  <ReviewAssetRow
                    key={asset.id}
                    asset={asset}
                    sourceViewed={viewedSources.has(asset.id)}
                    isReclassifying={reclassifyingId === asset.id}
                    onViewSource={() => openSourcePreview(asset)}
                    onApprove={() => approveAsset(asset.id)}
                    onReject={() => rejectAsset(asset.id)}
                    onStartReclassify={() => setReclassifyingId(asset.id)}
                    onReclassify={(type) => reclassifyAsset(asset.id, type)}
                    onCancelReclassify={() => setReclassifyingId(null)}
                  />
                ))}
                {!showAllItems && needsReview.length > SAMPLE_SIZE && (
                  <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-1" onClick={() => setShowAllItems(true)}>
                    <Eye className="w-3 h-3" /> عرض الكل ({needsReview.length})
                  </Button>
                )}
                {showAllItems && needsReview.length > visibleCount && (
                  <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-1" onClick={loadMore}>
                    تحميل المزيد ({needsReview.length - visibleCount} متبقي)
                  </Button>
                )}
              </AssetSection>
            )}

            {/* Permitted section */}
            {permitted.length > 0 && showPermitted && (
              <AssetSection title="الأصول المشمولة بالتقييم" icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} count={permitted.length} variant="success" expanded={expandedSections.permitted} onToggle={() => toggleSection("permitted")}>
                {getVisibleAssets(permitted).map(asset => (
                  <AssetRow key={asset.id} asset={asset} variant="success">
                    <button onClick={() => removeAsset(asset.id)} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </AssetRow>
                ))}
                {!showAllItems && permitted.length > SAMPLE_SIZE && (
                  <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-1" onClick={() => setShowAllItems(true)}>
                    <Eye className="w-3 h-3" /> عرض الكل ({permitted.length})
                  </Button>
                )}
                {showAllItems && permitted.length > visibleCount && (
                  <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-1" onClick={loadMore}>
                    تحميل المزيد ({permitted.length - visibleCount} متبقي)
                  </Button>
                )}
              </AssetSection>
            )}

            {/* Not Permitted section */}
            {notPermitted.length > 0 && showNotPermitted && (
              <AssetSection title="الأصول غير المشمولة بالتقييم" icon={<Ban className="w-4 h-4 text-destructive" />} count={notPermitted.length} variant="destructive" expanded={expandedSections.not_permitted} onToggle={() => toggleSection("not_permitted")}>
                {getVisibleAssets(notPermitted).map(asset => (
                  <AssetRow key={asset.id} asset={asset} variant="destructive" />
                ))}
                {!showAllItems && notPermitted.length > SAMPLE_SIZE && (
                  <Button variant="ghost" size="sm" className="w-full text-xs gap-1 mt-1" onClick={() => setShowAllItems(true)}>
                    <Eye className="w-3 h-3" /> عرض الكل ({notPermitted.length})
                  </Button>
                )}
              </AssetSection>
            )}

            {assets.length === 0 && (
              <div className="text-center py-8">
                <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لم يتم استخراج أي أصول</p>
              </div>
            )}

            {/* Review notes */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                ملاحظات المراجعة
                <Badge variant="secondary" className="text-[10px]">اختياري</Badge>
              </p>
              <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="أي ملاحظات أو توضيحات إضافية..." rows={2} />
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <Button onClick={handleApprove} className="w-full gap-2" size="lg" disabled={!canSubmit}>
                <FileCheck className="w-4 h-4" />
                اعتماد التحليل وإرسال الطلب ({permittedCount} أصل)
              </Button>
              <Button onClick={onBack} variant="outline" className="w-full gap-2" size="sm">
                <ArrowRight className="w-4 h-4" /> العودة لتعديل الملفات
              </Button>
              {!canSubmit && <p className="text-[10px] text-destructive text-center">لا يوجد أصول مشمولة — يرجى تأكيد عنصر واحد على الأقل</p>}
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

// ── Source Preview ──
function SourcePreviewContent({ asset }: { asset: ExtractedAsset }) {
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

      {fileType === "excel" && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">معاينة البيانات من الجدول</div>
          <div className="p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/20 rounded p-2"><span className="text-muted-foreground">الاسم:</span> <strong>{asset.name}</strong></div>
              <div className="bg-muted/20 rounded p-2"><span className="text-muted-foreground">النوع:</span> <strong>{asset.type || "—"}</strong></div>
              <div className="bg-muted/20 rounded p-2"><span className="text-muted-foreground">الكمية:</span> <strong>{asset.quantity}</strong></div>
              <div className="bg-muted/20 rounded p-2"><span className="text-muted-foreground">الفئة:</span> <strong>{asset.category || "—"}</strong></div>
            </div>
            {info?.row_number && (
              <div className="mt-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded p-2 text-[10px] text-amber-700 dark:text-amber-400">
                ← الصف {info.row_number} في الشيت "{info.sheet_name || "الأول"}"
              </div>
            )}
          </div>
        </div>
      )}

      {fileType === "pdf" && (
        <div className="border border-border rounded-lg p-3">
          <div className="bg-muted/20 rounded-lg p-4 text-center">
            <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">تم استخراج هذا العنصر من مستند PDF</p>
            {info?.page_number && <p className="text-[10px] text-muted-foreground/60 mt-1">الصفحة {info.page_number}</p>}
          </div>
        </div>
      )}

      {fileType === "image" && (
        <div className="border border-border rounded-lg p-3">
          <div className="bg-muted/20 rounded-lg p-4 text-center">
            <Image className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">تم استخراج هذا العنصر من صورة عبر التحليل البصري (Vision AI)</p>
            {info?.region && <p className="text-[10px] text-muted-foreground/60 mt-1">المنطقة: {info.region}</p>}
          </div>
        </div>
      )}

      {/* AI suggestion */}
      <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg p-2.5">
        <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] font-semibold text-primary">اقتراح النظام</p>
          <p className="text-[11px] text-foreground">{getAiSuggestion(asset)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Step-by-step review ──
function StepByStepReview({ asset, index, total, reviewed, onApprove, onReject, onViewSource, onReclassify, onPrev, onNext, onExit, sourceViewed }: {
  asset: ExtractedAsset; index: number; total: number; reviewed: number;
  onApprove: () => void; onReject: () => void; onViewSource: () => void;
  onReclassify: (type: string) => void;
  onPrev: () => void; onNext: () => void; onExit: () => void;
  sourceViewed: boolean;
}) {
  const [showReclassify, setShowReclassify] = useState(false);

  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">مراجعة فردية</span>
          </div>
          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={onExit}>إغلاق</Button>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>العنصر {index + 1} من {total}</span>
            <span>تمت مراجعة {reviewed}</span>
          </div>
          <Progress value={total > 0 ? ((index + 1) / total) * 100 : 0} className="h-1.5" />
        </div>

        {/* Asset details */}
        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
          <p className="text-sm font-bold text-foreground">{asset.name}</p>
          <div className="flex flex-wrap gap-2">
            {asset.category && <Badge variant="secondary" className="text-[10px]">{asset.category}</Badge>}
            <Badge variant="outline" className="text-[10px]">ثقة {asset.confidence}%</Badge>
            {asset.quantity > 1 && <Badge variant="secondary" className="text-[10px]">×{asset.quantity}</Badge>}
          </div>
          {asset.license_reason && (
            <div className="flex items-start gap-1 bg-amber-50/80 dark:bg-amber-900/10 rounded px-2 py-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-700 dark:text-amber-400">{asset.license_reason}</p>
            </div>
          )}
          <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg p-2">
            <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-foreground">{getAiSuggestion(asset)}</p>
          </div>
        </div>

        {/* Source button */}
        <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={onViewSource}>
          <Eye className="w-3.5 h-3.5" />
          عرض المصدر
          {sourceViewed && <CheckCircle className="w-3 h-3 text-emerald-500" />}
        </Button>

        {/* Decision buttons */}
        <div className="space-y-2">
          {!sourceViewed && (
            <p className="text-[10px] text-amber-600 text-center">يرجى عرض المصدر أولاً قبل اتخاذ القرار</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1 text-xs" disabled={!sourceViewed} onClick={onApprove}>
              <CheckCircle className="w-3.5 h-3.5" /> اعتماد كأصل
            </Button>
            <Button size="sm" variant="destructive" className="flex-1 gap-1 text-xs" disabled={!sourceViewed} onClick={onReject}>
              <XCircle className="w-3.5 h-3.5" /> استبعاد
            </Button>
          </div>

          {showReclassify ? (
            <div className="flex gap-2">
              <Select onValueChange={(val) => { onReclassify(val); setShowReclassify(false); }}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="اختر التصنيف الجديد" /></SelectTrigger>
                <SelectContent>
                  {RECLASSIFY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowReclassify(false)}>إلغاء</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full gap-1 text-xs" disabled={!sourceViewed} onClick={() => setShowReclassify(true)}>
              <Pencil className="w-3 h-3" /> تعديل التصنيف
            </Button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={onPrev} disabled={index === 0}>
            <ChevronRight className="w-3.5 h-3.5" /> السابق
          </Button>
          <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={onNext} disabled={index >= total - 1}>
            التالي <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Generic sub-components ──
function StatBox({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
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

function AssetSection({ title, icon, count, variant, expanded, onToggle, children }: {
  title: string; icon: React.ReactNode; count: number; variant: "success" | "warning" | "destructive"; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  const borderColor = variant === "success" ? "border-emerald-200" : variant === "warning" ? "border-amber-200" : "border-destructive/20";
  return (
    <Card className={borderColor}>
      <button onClick={onToggle} className="w-full p-3 flex items-center gap-2 text-right">
        {icon}
        <span className="text-xs font-semibold text-foreground flex-1">{title}</span>
        <Badge variant="secondary" className="text-[10px]">{count}</Badge>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {expanded && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </Card>
  );
}

function AssetRow({ asset, variant, children }: { asset: ExtractedAsset; variant: "success" | "warning" | "destructive"; children?: React.ReactNode }) {
  const bgColor = variant === "success" ? "bg-emerald-50/50 dark:bg-emerald-900/10" : variant === "warning" ? "bg-amber-50/50 dark:bg-amber-900/10" : "bg-destructive/5";
  const dotColor = variant === "success" ? "bg-emerald-500" : variant === "warning" ? "bg-amber-500" : "bg-destructive";
  return (
    <div className={`${bgColor} rounded-lg p-2.5 border border-border/30`}>
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full ${dotColor} shrink-0 mt-1.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-foreground truncate">{asset.name}</p>
            {asset.quantity > 1 && <Badge variant="secondary" className="text-[9px]">×{asset.quantity}</Badge>}
            <Badge variant="outline" className="text-[9px]">{asset.confidence}%</Badge>
            <Tooltip>
              <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60 shrink-0 cursor-help" /></TooltipTrigger>
              <TooltipContent side="top" className="max-w-[250px] text-[11px]"><p>{STATUS_TOOLTIPS[asset.license_status] || ""}</p></TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {asset.category && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{asset.category}</span>}
            {asset.source && <span className="text-[10px] text-muted-foreground/60">{asset.source}</span>}
          </div>
          {asset.license_reason && (
            <div className="flex items-start gap-1 mt-1.5 bg-muted/50 rounded px-2 py-1">
              <AlertTriangle className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground">{asset.license_reason}</p>
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Review Asset Row (needs_review with source + reclassify) ──
function ReviewAssetRow({ asset, sourceViewed, isReclassifying, onViewSource, onApprove, onReject, onStartReclassify, onReclassify, onCancelReclassify }: {
  asset: ExtractedAsset; sourceViewed: boolean; isReclassifying: boolean;
  onViewSource: () => void; onApprove: () => void; onReject: () => void;
  onStartReclassify: () => void; onReclassify: (type: string) => void; onCancelReclassify: () => void;
}) {
  return (
    <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-lg p-2.5 border border-border/30 space-y-2">
      <div className="flex items-start gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-foreground truncate">{asset.name}</p>
            {asset.quantity > 1 && <Badge variant="secondary" className="text-[9px]">×{asset.quantity}</Badge>}
            <Badge variant="outline" className="text-[9px]">{asset.confidence}%</Badge>
            <Tooltip>
              <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60 shrink-0 cursor-help" /></TooltipTrigger>
              <TooltipContent side="top" className="max-w-[250px] text-[11px]"><p>{STATUS_TOOLTIPS.needs_review}</p></TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {asset.category && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{asset.category}</span>}
            {asset.source_info?.file_name && (
              <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                {(() => { const I = FILE_TYPE_ICONS[asset.source_info?.file_type || "unknown"]; return <I className="w-3 h-3" />; })()}
                {asset.source_info.file_name}
                {asset.source_info.sheet_name && ` / ${asset.source_info.sheet_name}`}
                {asset.source_info.row_number && ` (صف ${asset.source_info.row_number})`}
              </span>
            )}
            {!asset.source_info?.file_name && asset.source && <span className="text-[10px] text-muted-foreground/60">{asset.source}</span>}
          </div>

          {/* Reason */}
          {asset.license_reason && (
            <div className="flex items-start gap-1 mt-1.5 bg-muted/50 rounded px-2 py-1">
              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground">{asset.license_reason}</p>
            </div>
          )}

          {/* AI Suggestion */}
          <div className="flex items-start gap-1 mt-1 bg-primary/5 rounded px-2 py-1">
            <Lightbulb className="w-3 h-3 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-foreground">{getAiSuggestion(asset)}</p>
          </div>
        </div>
      </div>

      {/* Source + actions */}
      <div className="flex items-center gap-1.5 flex-wrap pr-4">
        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={onViewSource}>
          <Eye className="w-3 h-3" /> عرض المصدر
          {sourceViewed && <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />}
        </Button>
        <Button size="sm" variant="default" className="h-6 text-[10px] gap-1" disabled={!sourceViewed} onClick={onApprove}>
          <CheckCircle className="w-3 h-3" /> اعتماد كأصل
        </Button>
        <Button size="sm" variant="destructive" className="h-6 text-[10px] gap-1" disabled={!sourceViewed} onClick={onReject}>
          <XCircle className="w-3 h-3" /> استبعاد
        </Button>
        {isReclassifying ? (
          <div className="flex gap-1">
            <Select onValueChange={onReclassify}>
              <SelectTrigger className="h-6 text-[10px] w-32"><SelectValue placeholder="التصنيف" /></SelectTrigger>
              <SelectContent>
                {RECLASSIFY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1" onClick={onCancelReclassify}>×</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" disabled={!sourceViewed} onClick={onStartReclassify}>
            <Pencil className="w-3 h-3" /> تعديل
          </Button>
        )}
      </div>

      {!sourceViewed && (
        <p className="text-[9px] text-amber-600 pr-4">⚠ يرجى عرض المصدر أولاً قبل اتخاذ القرار</p>
      )}
    </div>
  );
}
