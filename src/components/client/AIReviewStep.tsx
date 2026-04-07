import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Shield, ArrowRight, Package, FileCheck, Edit3,
  FileText, Image, Table2, Lightbulb, Pencil, Eye, AlertOctagon,
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

// ── Exclusion rules (hard block — outside license scope) ──
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

// ── Smart verification triggers (only these cause a flag) ──
type VerificationTrigger = { check: (a: ExtractedAsset) => boolean; reason: string };
const VERIFICATION_TRIGGERS: VerificationTrigger[] = [
  { check: a => a.confidence < 35, reason: "ثقة منخفضة جداً — بيانات قد تكون غير دقيقة" },
  { check: a => !a.name || a.name.trim().length < 3, reason: "اسم غير واضح" },
  { check: a => !a.category && !a.type, reason: "تصنيف غير محدد" },
  { check: a => a.quantity <= 0 || isNaN(a.quantity), reason: "كمية غير صحيحة" },
  { check: a => {
    // conflicting: name says one type but category says another
    const name = (a.name || "").toLowerCase();
    const cat = (a.category || "").toLowerCase();
    const isNameProperty = ["أرض", "عقار", "مبنى", "فيلا", "شقة", "land", "building"].some(k => name.includes(k));
    const isCatMachinery = ["آلات", "معدات", "machinery", "equipment"].some(k => cat.includes(k));
    return isNameProperty && isCatMachinery;
  }, reason: "تعارض بين الاسم والتصنيف" },
];

const RECLASSIFY_OPTIONS = [
  { value: "real_estate", label: "عقار" },
  { value: "machinery_equipment", label: "آلات ومعدات" },
  { value: "expense", label: "مصروف — ليس أصلاً" },
  { value: "not_asset", label: "غير أصل — استبعاد" },
];

const ASSET_TYPE_MAP: Record<string, { label: string; icon: typeof Building2 }> = {
  real_estate: { label: "عقار", icon: Building2 },
  machinery_equipment: { label: "آلات ومعدات", icon: Cog },
  both: { label: "عقار + آلات ومعدات", icon: Sparkles },
};

const FILE_TYPE_ICONS: Record<string, typeof FileText> = {
  excel: Table2, pdf: FileText, image: Image, unknown: FileText,
};

// ── Smart Classification (auto-pass unless flagged) ──
export function classifyAssetLicense(asset: ExtractedAsset): ExtractedAsset {
  const combined = `${(asset.category || asset.type || "").toLowerCase()} ${(asset.name || "").toLowerCase()}`;

  // 1. Hard exclusion
  for (const rule of EXCLUSION_RULES) {
    if (rule.keywords.some(k => combined.includes(k.toLowerCase()))) {
      return { ...asset, license_status: "not_permitted", license_reason: rule.reason };
    }
  }

  // 2. Check verification triggers — flag only if needed
  for (const trigger of VERIFICATION_TRIGGERS) {
    if (trigger.check(asset)) {
      return { ...asset, license_status: "needs_review", license_reason: trigger.reason };
    }
  }

  // 3. Everything else passes automatically
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
// MAIN COMPONENT — Smart Verification
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
  const [reviewNotes, setReviewNotes] = useState("");
  const [sourcePreviewAsset, setSourcePreviewAsset] = useState<ExtractedAsset | null>(null);
  const [reclassifyingId, setReclassifyingId] = useState<number | null>(null);

  const autoApproved = useMemo(() => assets.filter(a => a.license_status === "permitted"), [assets]);
  const flagged = useMemo(() => assets.filter(a => a.license_status === "needs_review"), [assets]);
  const excluded = useMemo(() => assets.filter(a => a.license_status === "not_permitted"), [assets]);

  const typeInfo = ASSET_TYPE_MAP[data.confirmedType];
  const TypeIcon = typeInfo?.icon || Sparkles;
  const canSubmit = autoApproved.length > 0;

  const resolveAsset = useCallback((id: number, status: "permitted" | "not_permitted", reason: string) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, license_status: status, license_reason: reason } : a));
  }, []);

  const reclassifyAsset = useCallback((id: number, newType: string) => {
    if (newType === "expense" || newType === "not_asset") {
      resolveAsset(id, "not_permitted", newType === "expense" ? "أعيد تصنيفه كمصروف" : "أعيد تصنيفه كغير أصل");
    } else {
      resolveAsset(id, "permitted", `أعيد تصنيفه كـ ${RECLASSIFY_OPTIONS.find(o => o.value === newType)?.label || newType}`);
    }
    setReclassifyingId(null);
  }, [resolveAsset]);

  const handleApprove = () => onApprove(assets.filter(a => a.license_status === "permitted"), reviewNotes);

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
              <QuickStat icon={<CheckCircle className="w-3.5 h-3.5 text-emerald-600" />} value={autoApproved.length} label="تمت المعالجة" color="text-emerald-600" />
              <QuickStat icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />} value={flagged.length} label="يتطلب تحقق" color="text-amber-500" />
              <QuickStat icon={<Shield className="w-3.5 h-3.5 text-destructive" />} value={excluded.length} label="مستبعد" color="text-destructive" />
            </div>

            {/* Status message */}
            {flagged.length === 0 ? (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg p-2.5 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400">جميع البنود تمت معالجتها تلقائياً — لا يوجد ما يتطلب تدخلك</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-2.5 border border-amber-200 dark:border-amber-800">
                <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  يوجد <strong>{flagged.length}</strong> بند يحتاج تأكيدك — باقي البنود ({autoApproved.length}) تمت معالجتها تلقائياً
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Flagged Items (needs verification) ── */}
        {flagged.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-bold text-foreground">بنود تتطلب تحقق ({flagged.length})</h4>
            </div>

            {flagged.map(asset => (
              <FlaggedItemCard
                key={asset.id}
                asset={asset}
                isReclassifying={reclassifyingId === asset.id}
                onViewSource={() => setSourcePreviewAsset(asset)}
                onApprove={() => resolveAsset(asset.id, "permitted", "تم تأكيده يدوياً")}
                onReject={() => resolveAsset(asset.id, "not_permitted", "تم استبعاده يدوياً")}
                onStartReclassify={() => setReclassifyingId(asset.id)}
                onReclassify={(type) => reclassifyAsset(asset.id, type)}
                onCancelReclassify={() => setReclassifyingId(null)}
              />
            ))}
          </div>
        )}

        {/* ── Auto-approved summary (collapsed) ── */}
        {autoApproved.length > 0 && (
          <AutoApprovedSection assets={autoApproved} onRemove={(id) => resolveAsset(id, "not_permitted", "تم استبعاده يدوياً")} />
        )}

        {/* ── Excluded summary ── */}
        {excluded.length > 0 && (
          <ExcludedSection assets={excluded} />
        )}

        {/* Empty state */}
        {assets.length === 0 && (
          <div className="text-center py-8">
            <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">لم يتم استخراج أي أصول</p>
          </div>
        )}

        {/* ── Notes ── */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
            ملاحظات
            <Badge variant="secondary" className="text-[10px]">اختياري</Badge>
          </p>
          <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="أي ملاحظات إضافية..." rows={2} />
        </div>

        {/* ── Actions ── */}
        <div className="space-y-2">
          <Button onClick={handleApprove} className="w-full gap-2" size="lg" disabled={!canSubmit}>
            <FileCheck className="w-4 h-4" />
            اعتماد وإرسال الطلب ({autoApproved.length} أصل)
          </Button>
          <Button onClick={onBack} variant="outline" className="w-full gap-2" size="sm">
            <ArrowRight className="w-4 h-4" /> العودة لتعديل الملفات
          </Button>
          {!canSubmit && <p className="text-[10px] text-destructive text-center">لا يوجد أصول معتمدة — يرجى تأكيد عنصر واحد على الأقل</p>}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ── Flagged Item Card ──
function FlaggedItemCard({ asset, isReclassifying, onViewSource, onApprove, onReject, onStartReclassify, onReclassify, onCancelReclassify }: {
  asset: ExtractedAsset; isReclassifying: boolean;
  onViewSource: () => void; onApprove: () => void; onReject: () => void;
  onStartReclassify: () => void; onReclassify: (type: string) => void; onCancelReclassify: () => void;
}) {
  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">{asset.name}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {asset.category && <Badge variant="secondary" className="text-[9px]">{asset.category}</Badge>}
              {asset.quantity > 1 && <Badge variant="outline" className="text-[9px]">×{asset.quantity}</Badge>}
              <Badge variant="outline" className="text-[9px]">ثقة {asset.confidence}%</Badge>
            </div>
          </div>
        </div>

        {/* Reason for flagging */}
        <div className="flex items-start gap-1.5 bg-amber-100/60 dark:bg-amber-900/20 rounded-lg px-2.5 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400">سبب التوقف:</p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">{asset.license_reason}</p>
          </div>
        </div>

        {/* AI suggestion if available */}
        {asset.ai_suggestion && (
          <div className="flex items-start gap-1.5 bg-primary/5 rounded-lg px-2.5 py-1.5">
            <Lightbulb className="w-3 h-3 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-foreground">{asset.ai_suggestion}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={onViewSource}>
            <Eye className="w-3 h-3" /> عرض المصدر
          </Button>
          <Button size="sm" variant="default" className="h-7 text-[10px] gap-1" onClick={onApprove}>
            <CheckCircle className="w-3 h-3" /> تأكيد كأصل
          </Button>
          <Button size="sm" variant="destructive" className="h-7 text-[10px] gap-1" onClick={onReject}>
            <XCircle className="w-3 h-3" /> استبعاد
          </Button>
          {isReclassifying ? (
            <div className="flex gap-1">
              <Select onValueChange={onReclassify}>
                <SelectTrigger className="h-7 text-[10px] w-32"><SelectValue placeholder="التصنيف" /></SelectTrigger>
                <SelectContent>
                  {RECLASSIFY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="h-7 text-[10px] px-1" onClick={onCancelReclassify}>×</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={onStartReclassify}>
              <Pencil className="w-3 h-3" /> تعديل
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Auto-Approved Section (clean, collapsed) ──
function AutoApprovedSection({ assets, onRemove }: { assets: ExtractedAsset[]; onRemove: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-emerald-200 dark:border-emerald-800">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-3 flex items-center gap-2 text-right">
        <CheckCircle className="w-4 h-4 text-emerald-600" />
        <span className="text-xs font-semibold text-foreground flex-1">بنود تمت معالجتها تلقائياً</span>
        <Badge variant="secondary" className="text-[10px]">{assets.length}</Badge>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {assets.map(a => (
            <div key={a.id} className="flex items-center gap-2 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg px-2.5 py-1.5 border border-border/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-[11px] text-foreground flex-1 truncate">{a.name}</p>
              {a.quantity > 1 && <span className="text-[9px] text-muted-foreground">×{a.quantity}</span>}
              {a.category && <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">{a.category}</span>}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => onRemove(a.id)} className="text-muted-foreground hover:text-destructive p-0.5">
                    <XCircle className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">استبعاد هذا البند</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Excluded Section ──
function ExcludedSection({ assets }: { assets: ExtractedAsset[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-destructive/20">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-3 flex items-center gap-2 text-right">
        <Shield className="w-4 h-4 text-destructive" />
        <span className="text-xs font-semibold text-foreground flex-1">بنود مستبعدة</span>
        <Badge variant="secondary" className="text-[10px]">{assets.length}</Badge>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {assets.map(a => (
            <div key={a.id} className="flex items-center gap-2 bg-destructive/5 rounded-lg px-2.5 py-1.5 border border-border/20">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-foreground truncate">{a.name}</p>
                {a.license_reason && <p className="text-[9px] text-muted-foreground">{a.license_reason}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
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

      {info?.row_number && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded p-2 text-[10px] text-amber-700 dark:text-amber-400">
          ← الصف {info.row_number} في الشيت "{info.sheet_name || "الأول"}"
        </div>
      )}
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
