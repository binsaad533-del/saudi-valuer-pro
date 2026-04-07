import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle, XCircle, AlertTriangle, Building2, Cog, Sparkles,
  Shield, Trash2, Edit3, ArrowRight, Package, Ban,
  HelpCircle, FileCheck, ChevronDown, ChevronUp, Layers, BarChart3,
  CheckCheck, XOctagon, Eye,
} from "lucide-react";

// ── Types ──
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

const PERMITTED_CATEGORIES = [
  "real_estate", "land", "building", "villa", "apartment", "commercial_property",
  "machinery_equipment", "machinery", "equipment", "vehicle", "furniture", "electronics",
  "عقار", "أرض", "مبنى", "فيلا", "شقة", "عقار تجاري", "آلات", "معدات", "مركبات", "أثاث",
];

const NOT_PERMITTED_CATEGORIES = [
  "intangible", "goodwill", "trademark", "patent", "copyright", "software_license",
  "financial_instrument", "stock", "bond", "derivative", "cryptocurrency",
  "أصول غير ملموسة", "شهرة", "علامة تجارية", "براءة اختراع",
];

const ASSET_TYPE_MAP: Record<string, { label: string; icon: typeof Building2 }> = {
  real_estate: { label: "عقار", icon: Building2 },
  machinery_equipment: { label: "آلات ومعدات", icon: Cog },
  both: { label: "عقار + آلات ومعدات", icon: Sparkles },
};

export function classifyAssetLicense(asset: ExtractedAsset): ExtractedAsset {
  const cat = (asset.category || asset.type || "").toLowerCase();
  const name = (asset.name || "").toLowerCase();
  const combined = `${cat} ${name}`;

  if (NOT_PERMITTED_CATEGORIES.some(k => combined.includes(k.toLowerCase()))) {
    return { ...asset, license_status: "not_permitted", license_reason: "خارج نطاق الترخيص الحالي" };
  }
  if (PERMITTED_CATEGORIES.some(k => combined.includes(k.toLowerCase()))) {
    return { ...asset, license_status: "permitted" };
  }
  return { ...asset, license_status: "needs_review", license_reason: "يحتاج تأكيد العميل" };
}

// ── Deduplication ──
function deduplicateAssets(assets: ExtractedAsset[]): { unique: ExtractedAsset[]; removedCount: number } {
  const seen = new Map<string, ExtractedAsset>();
  for (const asset of assets) {
    const key = `${(asset.name || "").trim().toLowerCase()}|${(asset.category || "").toLowerCase()}|${(asset.source || "").toLowerCase()}`;
    const existing = seen.get(key);
    if (existing) {
      existing.quantity += asset.quantity;
      if (asset.confidence > existing.confidence) {
        existing.confidence = asset.confidence;
      }
    } else {
      seen.set(key, { ...asset });
    }
  }
  const unique = Array.from(seen.values());
  return { unique, removedCount: assets.length - unique.length };
}

// ── Confidence Stats ──
function getConfidenceStats(assets: ExtractedAsset[]) {
  if (assets.length === 0) return { avg: 0, min: 0, max: 0 };
  const vals = assets.map(a => a.confidence);
  return {
    avg: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
    min: Math.min(...vals),
    max: Math.max(...vals),
  };
}

// ── Grouping ──
function groupByCategory(assets: ExtractedAsset[]): Record<string, ExtractedAsset[]> {
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

export default function AIReviewStep({ data, onApprove, onBack }: Props) {
  // Deduplicate on mount
  const { deduplicated, removedCount } = useMemo(() => {
    const { unique, removedCount } = deduplicateAssets(data.assets);
    // Excel source → all start as needs_review
    const processed = unique.map(a => {
      const isExcel = (a.source || "").toLowerCase().includes("excel") || (a.source || "").toLowerCase().includes("csv");
      if (isExcel && a.license_status === "permitted") {
        return { ...a, license_status: "needs_review" as const, license_reason: "مصدر Excel — يحتاج مراجعة" };
      }
      return a;
    });
    return { deduplicated: processed, removedCount };
  }, [data.assets]);

  const [assets, setAssets] = useState<ExtractedAsset[]>(deduplicated);
  const [reviewNotes, setReviewNotes] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    permitted: true, not_permitted: true, needs_review: true,
  });
  const [showAllItems, setShowAllItems] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LAZY_PAGE_SIZE);

  const permitted = useMemo(() => assets.filter(a => a.license_status === "permitted"), [assets]);
  const notPermitted = useMemo(() => assets.filter(a => a.license_status === "not_permitted"), [assets]);
  const needsReview = useMemo(() => assets.filter(a => a.license_status === "needs_review"), [assets]);

  const confidenceStats = useMemo(() => getConfidenceStats(assets), [assets]);
  const categoryGroups = useMemo(() => groupByCategory(assets), [assets]);

  const typeInfo = ASSET_TYPE_MAP[data.confirmedType];
  const TypeIcon = typeInfo?.icon || Sparkles;
  const isLargeDataset = assets.length > LARGE_DATASET_THRESHOLD;

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const removeAsset = useCallback((id: number) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  }, []);

  const approveAsset = useCallback((id: number) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, license_status: "permitted" as const, license_reason: "تم تأكيده من العميل" } : a));
  }, []);

  const rejectAsset = useCallback((id: number) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, license_status: "not_permitted" as const, license_reason: "تم رفضه من العميل" } : a));
  }, []);

  // ── Bulk Actions ──
  const bulkApproveAll = useCallback(() => {
    setAssets(prev => prev.map(a => a.license_status === "needs_review" ? { ...a, license_status: "permitted" as const, license_reason: "اعتماد جماعي" } : a));
  }, []);

  const bulkRejectAll = useCallback(() => {
    setAssets(prev => prev.map(a => a.license_status === "needs_review" ? { ...a, license_status: "not_permitted" as const, license_reason: "استبعاد جماعي" } : a));
  }, []);

  const bulkApproveCategory = useCallback((category: string) => {
    setAssets(prev => prev.map(a => {
      const cat = a.category || a.type || "غير مصنف";
      return cat === category && a.license_status === "needs_review"
        ? { ...a, license_status: "permitted" as const, license_reason: "اعتماد حسب الفئة" }
        : a;
    }));
  }, []);

  const handleApprove = () => {
    const approvedAssets = assets.filter(a => a.license_status === "permitted");
    onApprove(approvedAssets, reviewNotes);
  };

  const permittedCount = permitted.length;
  const canSubmit = permittedCount > 0;

  // Sampling: show first N items, with "show all" toggle
  const getVisibleAssets = (list: ExtractedAsset[]) => {
    if (showAllItems || list.length <= SAMPLE_SIZE) return list.slice(0, visibleCount);
    return list.slice(0, SAMPLE_SIZE);
  };

  const loadMore = () => setVisibleCount(prev => prev + LAZY_PAGE_SIZE);

  return (
    <div className="space-y-5">
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

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <StatBox icon={<CheckCircle className="w-3.5 h-3.5 text-emerald-600" />} value={permitted.length} label="مشمول" color="text-emerald-600" />
            <StatBox icon={<Ban className="w-3.5 h-3.5 text-destructive" />} value={notPermitted.length} label="غير مشمول" color="text-destructive" />
            <StatBox icon={<HelpCircle className="w-3.5 h-3.5 text-amber-500" />} value={needsReview.length} label="يحتاج مراجعة" color="text-amber-500" />
          </div>

          {/* Confidence stats */}
          <div className="flex items-center gap-3 bg-background rounded-lg p-2 border border-border/50">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-4 text-[10px]">
              <span>متوسط الثقة: <strong className="text-foreground">{confidenceStats.avg}%</strong></span>
              <span>أدنى: <strong className="text-destructive">{confidenceStats.min}%</strong></span>
              <span>أعلى: <strong className="text-emerald-600">{confidenceStats.max}%</strong></span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Large dataset warning */}
      {isLargeDataset && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-700">عدد الأصول كبير ({assets.length} عنصر)</p>
            <p className="text-[10px] text-amber-600/80 mt-0.5">
              ننصح بمراجعة عينة قبل الاعتماد. يمكنك استخدام "اعتماد حسب الفئة" لتسريع المراجعة.
            </p>
          </div>
        </div>
      )}

      {/* Category Grouping overview */}
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
      {notPermitted.length > 0 && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <Shield className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-destructive">بعض العناصر ليست ضمن نطاق الترخيص</p>
            <p className="text-[10px] text-destructive/80 mt-0.5">
              بعض العناصر المرفوعة ليست ضمن نطاق الترخيص الحالي ولا يمكن تضمينها في طلب التقييم. ستُستبعد تلقائياً.
            </p>
          </div>
        </div>
      )}

      {/* Bulk actions for needs_review */}
      {needsReview.length > 0 && (
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

      {/* ── Section: Needs Review ── */}
      {needsReview.length > 0 && (
        <AssetSection
          title="عناصر تحتاج مراجعة العميل"
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          count={needsReview.length}
          variant="warning"
          expanded={expandedSections.needs_review}
          onToggle={() => toggleSection("needs_review")}
        >
          {getVisibleAssets(needsReview).map(asset => (
            <AssetRow key={asset.id} asset={asset} variant="warning">
              <div className="flex gap-1.5 mt-2">
                <Button size="sm" variant="default" className="h-7 text-[10px] gap-1" onClick={() => approveAsset(asset.id)}>
                  <CheckCircle className="w-3 h-3" /> تأكيد
                </Button>
                <Button size="sm" variant="destructive" className="h-7 text-[10px] gap-1" onClick={() => rejectAsset(asset.id)}>
                  <XCircle className="w-3 h-3" /> استبعاد
                </Button>
              </div>
            </AssetRow>
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

      {/* ── Section: Permitted ── */}
      {permitted.length > 0 && (
        <AssetSection
          title="الأصول المشمولة بالتقييم"
          icon={<CheckCircle className="w-4 h-4 text-emerald-600" />}
          count={permitted.length}
          variant="success"
          expanded={expandedSections.permitted}
          onToggle={() => toggleSection("permitted")}
        >
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

      {/* ── Section: Not Permitted ── */}
      {notPermitted.length > 0 && (
        <AssetSection
          title="الأصول غير المشمولة بالتقييم"
          icon={<Ban className="w-4 h-4 text-destructive" />}
          count={notPermitted.length}
          variant="destructive"
          expanded={expandedSections.not_permitted}
          onToggle={() => toggleSection("not_permitted")}
        >
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

      {/* Empty state */}
      {assets.length === 0 && (
        <div className="text-center py-8">
          <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">لم يتم استخراج أي أصول من الملفات المرفوعة</p>
        </div>
      )}

      {/* Review notes */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
          ملاحظات المراجعة
          <Badge variant="secondary" className="text-[10px]">اختياري</Badge>
        </p>
        <Textarea
          value={reviewNotes}
          onChange={e => setReviewNotes(e.target.value)}
          placeholder="أي ملاحظات أو توضيحات إضافية حول الأصول المستخرجة..."
          rows={2}
        />
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        <Button onClick={handleApprove} className="w-full gap-2" size="lg" disabled={!canSubmit}>
          <FileCheck className="w-4 h-4" />
          اعتماد التحليل وإرسال الطلب ({permittedCount} أصل)
        </Button>
        <Button onClick={onBack} variant="outline" className="w-full gap-2" size="sm">
          <ArrowRight className="w-4 h-4" />
          العودة لتعديل الملفات
        </Button>
        {!canSubmit && (
          <p className="text-[10px] text-destructive text-center">
            لا يوجد أصول مشمولة بالتقييم — يرجى تأكيد عنصر واحد على الأقل
          </p>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

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

function AssetSection({
  title, icon, count, variant, expanded, onToggle, children,
}: {
  title: string; icon: React.ReactNode; count: number;
  variant: "success" | "warning" | "destructive";
  expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  const borderColor = variant === "success" ? "border-emerald-200" : variant === "warning" ? "border-amber-200" : "border-destructive/20";
  return (
    <Card className={`${borderColor}`}>
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
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {asset.category && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{asset.category}</span>}
            {asset.source && <span className="text-[10px] text-muted-foreground/60">{asset.source}</span>}
          </div>
          {asset.license_reason && variant !== "success" && (
            <p className="text-[10px] text-muted-foreground/70 mt-1">{asset.license_reason}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
