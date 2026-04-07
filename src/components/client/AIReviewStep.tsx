import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  CheckCircle, XCircle, Building2, Cog, Sparkles,
  Shield, ArrowRight, Package, FileCheck,
  MessageCircleQuestion, Send,
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
type TriggerType = "low_confidence" | "unclear_name" | "no_category" | "bad_quantity" | "conflict" | "high_impact" | "unusual";

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

/** Group similar flagged assets into combined questions to reduce noise */
function generateSmartQuestions(flaggedAssets: ExtractedAsset[]): SmartQuestion[] {
  if (flaggedAssets.length === 0) return [];

  // Group by trigger type
  const groups = new Map<TriggerType, ExtractedAsset[]>();
  for (const asset of flaggedAssets) {
    const trigger = detectTriggerType(asset);
    const list = groups.get(trigger) || [];
    list.push(asset);
    groups.set(trigger, list);
  }

  const questions: SmartQuestion[] = [];

  for (const [trigger, assets] of groups) {
    // If multiple similar assets, combine into one question
    if (assets.length > 1 && (trigger === "low_confidence" || trigger === "no_category")) {
      const names = assets.slice(0, 4).map(a => `"${a.name}"`).join("، ");
      const extra = assets.length > 4 ? ` و${assets.length - 4} آخرين` : "";

      if (trigger === "low_confidence") {
        questions.push({
          id: `group-${trigger}`,
          assetIds: assets.map(a => a.id),
          question: `${names}${extra} — نسبة الثقة منخفضة. هل تريد تضمينها؟`,
          options: [
            { label: "نعم، تضمين الجميع", action: "approve" },
            { label: "لا، استبعاد الجميع", action: "exclude" },
          ],
          allowCustom: false,
          triggerType: trigger,
        });
      } else {
        questions.push({
          id: `group-${trigger}`,
          assetIds: assets.map(a => a.id),
          question: `${names}${extra} — بدون تصنيف. ما نوعها؟`,
          options: [
            { label: "عقار", action: "update", updateField: "category", updateValue: "real_estate" },
            { label: "آلات ومعدات", action: "update", updateField: "category", updateValue: "machinery_equipment" },
            { label: "أثاث ومفروشات", action: "update", updateField: "category", updateValue: "furniture" },
            { label: "استبعاد الجميع", action: "exclude" },
          ],
          allowCustom: true,
          customPlaceholder: "تصنيف آخر...",
          triggerType: trigger,
        });
      }
    } else {
      // Individual questions
      for (const asset of assets) {
        questions.push(generateSingleQuestion(asset, trigger));
      }
    }
  }

  return questions;
}

function generateSingleQuestion(asset: ExtractedAsset, triggerType: TriggerType): SmartQuestion {
  const base: Partial<SmartQuestion> = { id: `single-${asset.id}`, assetIds: [asset.id], triggerType };

  switch (triggerType) {
    case "unclear_name":
      return {
        ...base,
        question: `هذا البند اسمه غير واضح: "${asset.name || "—"}". ما الاسم الصحيح؟`,
        options: [{ label: "استبعاد هذا البند", action: "exclude" }],
        allowCustom: true,
        customPlaceholder: "اكتب الاسم الصحيح...",
      } as SmartQuestion;

    case "no_category":
      return {
        ...base,
        question: `"${asset.name}" — ما تصنيفه؟`,
        options: [
          { label: "عقار", action: "update", updateField: "category", updateValue: "real_estate" },
          { label: "آلات ومعدات", action: "update", updateField: "category", updateValue: "machinery_equipment" },
          { label: "أثاث ومفروشات", action: "update", updateField: "category", updateValue: "furniture" },
          { label: "استبعاد", action: "exclude" },
        ],
        allowCustom: true,
        customPlaceholder: "تصنيف آخر...",
      } as SmartQuestion;

    case "bad_quantity":
      return {
        ...base,
        question: `"${asset.name}" — الكمية المسجلة (${asset.quantity}) غير صحيحة. ما العدد الفعلي؟`,
        options: [
          { label: "1", action: "update", updateField: "quantity", updateValue: "1" },
          { label: "استبعاد", action: "exclude" },
        ],
        allowCustom: true,
        customPlaceholder: "أدخل الكمية...",
      } as SmartQuestion;

    case "conflict":
      return {
        ...base,
        question: `"${asset.name}" مصنف كـ "${asset.category}" — يبدو أن هناك تعارض. هل التصنيف صحيح؟`,
        options: [
          { label: "نعم، صحيح", action: "approve" },
          { label: "عقار", action: "update", updateField: "category", updateValue: "real_estate" },
          { label: "آلات ومعدات", action: "update", updateField: "category", updateValue: "machinery_equipment" },
          { label: "استبعاد", action: "exclude" },
        ],
        allowCustom: false,
      } as SmartQuestion;

    case "low_confidence":
    default:
      return {
        ...base,
        question: `"${asset.name}" — الثقة في الاستخراج منخفضة (${asset.confidence}%). هل تريد تضمينه؟`,
        options: [
          { label: "نعم، تضمينه", action: "approve" },
          { label: "لا، استبعاده", action: "exclude" },
        ],
        allowCustom: false,
      } as SmartQuestion;
  }
}

// ── Chat message types ──
interface ChatMessage {
  id: string;
  type: "system" | "question" | "answer" | "info";
  text: string;
  questionData?: SmartQuestion;
  timestamp: number;
}

// ══════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════
export default function AIReviewStep({ data, onApprove, onBack }: Props) {
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  // Generate all questions upfront from initially-flagged assets
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
      // Greeting
      const greeting = data.clientName
        ? `مرحباً ${data.clientName}، نحتاج توضيح بسيط لبعض البنود`
        : "مرحباً، نحتاج توضيح بسيط لبعض البنود";
      initial.push({ id: "greeting", type: "system", text: greeting, timestamp: Date.now() });

      // Summary
      const summaryParts = [];
      if (autoApproved.length > 0) summaryParts.push(`✅ ${autoApproved.length} بند جاهز`);
      if (excluded.length > 0) summaryParts.push(`🚫 ${excluded.length} مستبعد`);
      summaryParts.push(`❓ ${questions.length} سؤال بسيط`);
      initial.push({ id: "summary", type: "info", text: summaryParts.join("  •  "), timestamp: Date.now() + 1 });

      // First question
      initial.push({
        id: `q-0`,
        type: "question",
        text: questions[0].question,
        questionData: questions[0],
        timestamp: Date.now() + 2,
      });
    } else {
      // No questions — go straight to final
      const summary = `✅ تم تحليل ${assets.length} بند تلقائياً — جميعها جاهزة`;
      initial.push({ id: "auto-done", type: "info", text: summary, timestamp: Date.now() });
    }

    setMessages(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const resolveAssets = useCallback((ids: number[], status: "permitted" | "not_permitted", reason: string, updates?: Partial<ExtractedAsset>) => {
    setAssets(prev => prev.map(a => ids.includes(a.id) ? { ...a, ...updates, license_status: status, license_reason: reason } : a));
  }, []);

  const advanceToNext = useCallback((answerText: string) => {
    // Add answer message
    setMessages(prev => [...prev, {
      id: `a-${currentQIdx}`,
      type: "answer",
      text: answerText,
      timestamp: Date.now(),
    }]);

    setShowCustomInput(false);
    setCustomValue("");

    const nextIdx = currentQIdx + 1;
    if (nextIdx < questions.length) {
      setCurrentQIdx(nextIdx);
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `q-${nextIdx}`,
          type: "question",
          text: questions[nextIdx].question,
          questionData: questions[nextIdx],
          timestamp: Date.now(),
        }]);
      }, 300);
    } else {
      // All questions done → final
      setPhase("final");
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: "final-q",
          type: "question",
          text: "هل ترغب بإضافة أي معلومات مهمة قد تؤثر على التقييم؟",
          timestamp: Date.now(),
        }]);
      }, 300);
    }
  }, [currentQIdx, questions]);

  const handleOptionClick = useCallback((question: SmartQuestion, opt: SmartQuestion["options"][0]) => {
    if (opt.action === "approve") {
      resolveAssets(question.assetIds, "permitted", "تم تأكيده من العميل");
    } else if (opt.action === "exclude") {
      resolveAssets(question.assetIds, "not_permitted", "تم استبعاده من العميل");
    } else if (opt.action === "update" && opt.updateField) {
      const updates: any = { [opt.updateField]: opt.updateValue };
      resolveAssets(question.assetIds, "permitted", `تم تحديث ${opt.updateField}`, updates);
    }
    advanceToNext(opt.label);
  }, [resolveAssets, advanceToNext]);

  const handleCustomSubmit = useCallback((question: SmartQuestion) => {
    if (!customValue.trim()) return;
    const val = customValue.trim();

    if (question.triggerType === "unclear_name") {
      resolveAssets(question.assetIds, "permitted", "تم تصحيح الاسم", { name: val });
    } else if (question.triggerType === "no_category") {
      resolveAssets(question.assetIds, "permitted", "تم تحديد التصنيف", { category: val });
    } else if (question.triggerType === "bad_quantity") {
      const qty = parseInt(val);
      if (qty > 0) resolveAssets(question.assetIds, "permitted", "تم تصحيح الكمية", { quantity: qty });
    }
    advanceToNext(val);
  }, [customValue, resolveAssets, advanceToNext]);

  const handleFinalSubmit = (hasNotes: boolean) => {
    if (hasNotes && additionalNotes.trim()) {
      setMessages(prev => [...prev, { id: "final-a", type: "answer", text: additionalNotes.trim(), timestamp: Date.now() }]);
    } else {
      setMessages(prev => [...prev, { id: "final-a", type: "answer", text: "لا يوجد", timestamp: Date.now() }]);
    }
    setPhase("done");
    setTimeout(() => {
      setMessages(prev => [...prev, { id: "done-msg", type: "system", text: "✅ تم — يمكنك اعتماد الطلب الآن", timestamp: Date.now() }]);
    }, 200);
  };

  const handleApprove = () => onApprove(assets.filter(a => a.license_status === "permitted"), additionalNotes);

  const canSubmit = phase === "done" || (questions.length === 0 && phase === "final");
  const approvedCount = assets.filter(a => a.license_status === "permitted").length;

  // Current active question (for rendering buttons)
  const activeQuestion = phase === "questions" && currentQIdx < questions.length ? questions[currentQIdx] : null;
  const isLastMessage = (msgId: string) => messages.length > 0 && messages[messages.length - 1].id === msgId;

  return (
    <div className="space-y-4">
      {/* ── Summary Header ── */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
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
        </CardContent>
      </Card>

      {/* ── Chat Area ── */}
      <div className="bg-muted/20 rounded-xl border border-border p-3 space-y-2.5 max-h-[55vh] overflow-y-auto">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.type === "answer" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.type === "system"
                ? "bg-primary/10 text-primary border border-primary/20"
                : msg.type === "info"
                  ? "bg-muted text-muted-foreground border border-border/50"
                  : msg.type === "answer"
                    ? "bg-card text-foreground border border-border shadow-sm"
                    : "bg-card text-foreground border border-border shadow-sm"
            }`}>
              <p className="text-[13px]">{msg.text}</p>

              {/* Render action buttons only for the LAST question message */}
              {msg.type === "question" && msg.questionData && isLastMessage(msg.id) && activeQuestion && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {msg.questionData.options.map((opt, i) => (
                      <Button
                        key={i}
                        size="sm"
                        variant={opt.action === "exclude" ? "destructive" : opt.action === "approve" ? "default" : "secondary"}
                        className="h-7 text-[11px] gap-1 rounded-full"
                        onClick={() => handleOptionClick(msg.questionData!, opt)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  {msg.questionData.allowCustom && (
                    <>
                      {!showCustomInput ? (
                        <button onClick={() => setShowCustomInput(true)} className="text-[10px] text-primary hover:underline">
                          إجابة مخصصة ←
                        </button>
                      ) : (
                        <div className="flex gap-1.5 mt-1">
                          <Input
                            value={customValue}
                            onChange={e => setCustomValue(e.target.value)}
                            placeholder={msg.questionData.customPlaceholder}
                            className="h-7 text-[11px] flex-1"
                            onKeyDown={e => { if (e.key === "Enter" && customValue.trim()) handleCustomSubmit(msg.questionData!); }}
                            autoFocus
                          />
                          <Button size="sm" className="h-7 text-[11px] px-2" disabled={!customValue.trim()} onClick={() => handleCustomSubmit(msg.questionData!)}>
                            <Send className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Final question buttons */}
              {msg.id === "final-q" && phase === "final" && isLastMessage(msg.id) && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={additionalNotes}
                    onChange={e => setAdditionalNotes(e.target.value)}
                    placeholder="مثال: بعض المعدات متوقفة عن العمل..."
                    rows={2}
                    className="text-[12px]"
                  />
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="flex-1 text-[11px] h-7 rounded-full" onClick={() => handleFinalSubmit(false)}>
                      لا يوجد
                    </Button>
                    <Button size="sm" className="flex-1 text-[11px] h-7 rounded-full" onClick={() => handleFinalSubmit(true)} disabled={!additionalNotes.trim()}>
                      إرسال
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* ── Progress indicator ── */}
      {phase === "questions" && questions.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <div className="flex-1 bg-muted rounded-full h-1.5">
            <div
              className="bg-primary rounded-full h-1.5 transition-all duration-300"
              style={{ width: `${Math.round((currentQIdx / questions.length) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {currentQIdx} / {questions.length}
          </span>
        </div>
      )}

      {/* ── Stats bar ── */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/30">
        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> {approvedCount} جاهز</span>
        <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-destructive" /> {excluded.length} مستبعد</span>
        <span className="flex items-center gap-1"><Package className="w-3 h-3 text-muted-foreground" /> {assets.length} إجمالي</span>
      </div>

      {/* ── Submit ── */}
      <div className="space-y-2">
        <Button onClick={handleApprove} className="w-full gap-2" size="lg" disabled={!canSubmit || approvedCount === 0}>
          <FileCheck className="w-4 h-4" />
          اعتماد وإرسال الطلب ({approvedCount} أصل)
        </Button>
        <Button onClick={onBack} variant="outline" className="w-full gap-2" size="sm">
          <ArrowRight className="w-4 h-4" /> العودة لتعديل الملفات
        </Button>
        {approvedCount === 0 && phase === "done" && (
          <p className="text-[10px] text-destructive text-center">لا يوجد أصول معتمدة — أضف أصولاً أو عُد لتعديل الملفات</p>
        )}
      </div>
    </div>
  );
}
