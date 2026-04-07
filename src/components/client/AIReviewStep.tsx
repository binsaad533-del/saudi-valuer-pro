import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  FileText, AlertCircle, Eye,
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

// ── Verification triggers ──
type TriggerType = "low_confidence" | "unclear_name" | "no_category" | "bad_quantity" | "conflict";

interface VerificationTrigger {
  check: (a: ExtractedAsset) => boolean;
  reason: string;
  triggerType: TriggerType;
}

const VERIFICATION_TRIGGERS: VerificationTrigger[] = [
  { check: a => a.confidence < 35, reason: "ثقة منخفضة جداً", triggerType: "low_confidence" },
  { check: a => !a.name || a.name.trim().length < 3, reason: "اسم غير واضح", triggerType: "unclear_name" },
  { check: a => !a.category && !a.type, reason: "تصنيف غير محدد", triggerType: "no_category" },
  { check: a => a.quantity <= 0 || isNaN(a.quantity), reason: "كمية غير صحيحة", triggerType: "bad_quantity" },
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
  },
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

  const autoApproved = useMemo(() => assets.filter(a => a.license_status === "permitted"), [assets]);
  const excluded = useMemo(() => assets.filter(a => a.license_status === "not_permitted"), [assets]);
  const flagged = useMemo(() => assets.filter(a => a.license_status === "needs_review"), [assets]);

  const [questions] = useState<SmartQuestion[]>(() => generateSmartQuestions(processed.filter(a => a.license_status === "needs_review")));
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [phase, setPhase] = useState<"questions" | "final" | "done">(questions.length === 0 ? "final" : "questions");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const typeInfo = ASSET_TYPE_MAP[data.confirmedType];
  const TypeIcon = typeInfo?.icon || Sparkles;

  // Initialize chat
  useEffect(() => {
    const initial: ChatMessage[] = [];
    if (questions.length > 0) {
      const greeting = data.clientName
        ? `مرحباً ${data.clientName}، راجعت المرفقات واحتاج تأكيد بسيط لبعض البنود`
        : "مرحباً، راجعت المرفقات واحتاج تأكيد بسيط لبعض البنود";
      initial.push({ id: "greeting", type: "system", text: greeting, timestamp: Date.now() });
      initial.push({ id: `q-0`, type: "question", text: questions[0].question, questionData: questions[0], timestamp: Date.now() + 1 });
    } else {
      initial.push({ id: "auto-done", type: "info", text: "✅ جميع البنود واضحة — لا تحتاج توضيح", timestamp: Date.now() });
    }
    setMessages(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const resolveAssets = useCallback((ids: number[], status: "permitted" | "not_permitted", reason: string, updates?: Partial<ExtractedAsset>) => {
    setAssets(prev => prev.map(a => ids.includes(a.id) ? { ...a, ...updates, license_status: status, license_reason: reason } : a));
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

      {/* ── 3. Raqeem Chat (complementary, not replacement) ── */}
      {(questions.length > 0 || phase !== "done") && (
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
            <div className="px-3 py-2 space-y-2 max-h-[30vh] overflow-y-auto">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.type === "answer" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[88%] rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
                    msg.type === "system" ? "bg-primary/10 text-primary"
                      : msg.type === "info" ? "bg-muted text-muted-foreground"
                        : msg.type === "answer" ? "bg-card text-foreground border border-border shadow-sm"
                          : "bg-card text-foreground border border-border shadow-sm"
                  }`}>
                    <p>{msg.text}</p>

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
          </CardContent>
        </Card>
      )}

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
