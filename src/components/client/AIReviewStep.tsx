import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildSafeStorageObject } from "@/lib/storage-path";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  CheckCircle, Cog, Shield, ArrowRight,
  Package, FileCheck, Send, FileText, AlertCircle, Eye,
  Paperclip, Loader2, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";

// Re-export types for consumers
export type { ExtractedAsset, AIReviewData, AssetSourceInfo } from "./ai-review/types";
export { classifyAssetLicense } from "./ai-review/engine";

import type {
  ExtractedAsset, AIReviewData, AssetSourceInfo,
  SmartQuestion, ChatAttachment, ChatMessage,
} from "./ai-review/types";
import { COMPANY, TYPE_LABELS } from "./ai-review/constants";
import {
  classifyAssetLicense, isHardExcluded, consistencyCheck,
  deduplicateAssets, buildExclusionExplanation,
  generateSmartQuestions, sourceLabel,
} from "./ai-review/engine";

interface Props {
  data: AIReviewData;
  onApprove: (approved: ExtractedAsset[], notes: string) => void;
  onBack: () => void;
}

// ── Status badge ──
function StatusBadge({ status }: { status: ExtractedAsset["license_status"] }) {
  if (status === "permitted") return <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-[9px] px-2 py-0.5 whitespace-nowrap">✓ ضمن النطاق</Badge>;
  if (status === "not_permitted") return <Badge variant="destructive" className="text-[9px] px-2 py-0.5 whitespace-nowrap">✗ مستبعد</Badge>;
  return <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-200 text-[9px] px-2 py-0.5 whitespace-nowrap animate-pulse">⟳ بانتظار</Badge>;
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
      <span className="text-foreground text-xs font-medium">{value}</span>
    </div>
  );
}

// ══════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════
export default function AIReviewStep({ data, onApprove, onBack }: Props) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
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
  const chatFileRef = useRef<HTMLInputElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // ── Chat file upload handler ──
  const handleChatFileUpload = useCallback(async (fileList: FileList) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setIsUploading(true);
    const newAttachments: ChatAttachment[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const { storageKey, originalFilename } = buildSafeStorageObject({ userId: user.id, originalFilename: file.name });
        const { error } = await supabase.storage.from("client-uploads").upload(storageKey, file);
        if (error) { console.error("Upload error:", error); continue; }
        newAttachments.push({ name: originalFilename, size: file.size, type: file.type, path: storageKey });
      } catch (err) { console.error("File upload failed:", err); }
    }
    setPendingAttachments(prev => [...prev, ...newAttachments]);
    setIsUploading(false);
    if (chatFileRef.current) chatFileRef.current.value = "";
  }, []);

  const removePendingAttachment = useCallback((idx: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const requestScopeSummary = useMemo(() => {
    const scope = data.requestScope;
    if (!scope) return null;

    const details = [
      { label: "اسم العميل", value: scope.clientName || data.clientName || "" },
      { label: "الجوال", value: scope.phone || "" },
      { label: "الغرض من التقييم", value: scope.purpose || "" },
      { label: "المستخدم المستهدف", value: scope.intendedUser || "" },
      { label: "نوع التقييم", value: scope.valuationMode || "" },
      { label: "نوع الأصل", value: scope.assetType || "" },
      { label: "البريد الإلكتروني", value: scope.email || "" },
      { label: "رقم الهوية / السجل", value: scope.idNumber || "" },
    ].filter((item): item is { label: string; value: string } => Boolean(item.value && item.value.trim()));

    const files = (scope.files || []).map((file) => file.name).filter(Boolean);
    const locations = (scope.locations || []).map((location) => ({
      name: location.name || "موقع",
      meta: [
        location.city,
        location.latitude != null && location.longitude != null
          ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
          : null,
      ].filter(Boolean).join(" • ") || "تم إرفاق رابط الموقع",
    }));
    const notes = scope.notes?.trim() || "";

    const chatText = [
      "📌 نطاق العمل المرسل من العميل قبل المراجعة:",
      ...details.map(({ label, value }) => `• ${label}: ${value}`),
      files.length > 0 ? `• الملفات المرفقة: ${files.join("، ")}` : null,
      locations.length > 0 ? `• المواقع: ${locations.map((location) => `${location.name} (${location.meta})`).join("، ")}` : null,
      notes ? `• ملاحظات العميل: ${notes}` : null,
    ].filter(Boolean).join("\n");

    return { details, files, locations, notes, chatText };
  }, [data.clientName, data.requestScope]);

  // Build asset context string for AI
  const assetContextStr = useMemo(() => {
    return `📊 إحصائيات الأصول:
• إجمالي الأصول الأصلية المرفوعة: ${data.assets.length}
• عناصر مكررة تم إزالتها تلقائياً: ${removedCount}${removedCount > 0 ? ` (أمثلة: ${[...new Set(duplicateNames)].slice(0, 15).join("، ")})` : ""}
• الأصول الفريدة بعد الدمج: ${assets.length}
• ضمن النطاق: ${autoApproved.length} ✅
• مستبعد (خارج نطاق الترخيص): ${excluded.length} 🚫${excluded.length > 0 ? `\n  المستبعدة: ${excluded.map(a => `"${a.name}" — ${a.license_reason || "خارج النطاق"}`).join("، ")}` : ""}
• بانتظار التوضيح: ${flagged.length} ❓${flagged.length > 0 ? `\n  بانتظار المراجعة: ${flagged.map(a => `"${a.name}" — ${a.license_reason || "بيانات ناقصة"}`).join("، ")}` : ""}${requestScopeSummary?.chatText ? `\n\n${requestScopeSummary.chatText}` : ""}`;
  }, [data.assets.length, removedCount, duplicateNames, assets.length, autoApproved.length, excluded, flagged, requestScopeSummary]);

  // Build detailed asset list for AI deep context
  const assetDetailsStr = useMemo(() => {
    const lines: string[] = [];
    if (duplicateNames.length > 0) {
      const uniqueDups = [...new Set(duplicateNames)];
      lines.push(`\n### العناصر المكررة التي تم دمجها (${removedCount} عنصر):`);
      uniqueDups.forEach((name, i) => {
        const count = duplicateNames.filter(n => n === name).length;
        lines.push(`${i + 1}. "${name}" — تكرر ${count + 1} مرة (تم الإبقاء على نسخة واحدة)`);
      });
    }
    if (autoApproved.length > 0) {
      lines.push(`\n### الأصول المعتمدة للتقييم (${autoApproved.length}):`);
      autoApproved.slice(0, 50).forEach((a, i) => {
        lines.push(`${i + 1}. "${a.name}" | النوع: ${a.type || "غير محدد"} | التصنيف: ${a.category || "—"} | الكمية: ${a.quantity} | الحالة: ${a.condition || "—"} | المصدر: ${a.source || "—"} | الثقة: ${Math.round(a.confidence * 100)}%`);
      });
      if (autoApproved.length > 50) lines.push(`... و${autoApproved.length - 50} أصل آخر`);
    }
    if (excluded.length > 0) {
      lines.push(`\n### الأصول المستبعدة (${excluded.length}):`);
      excluded.forEach((a, i) => {
        lines.push(`${i + 1}. "${a.name}" — السبب: ${a.license_reason || "خارج نطاق الترخيص"}`);
      });
    }
    if (flagged.length > 0) {
      lines.push(`\n### أصول بانتظار التوضيح (${flagged.length}):`);
      flagged.forEach((a, i) => {
        lines.push(`${i + 1}. "${a.name}" — السبب: ${a.license_reason || "بيانات ناقصة"}`);
      });
    }
    if (requestScopeSummary) {
      lines.push(`\n### نطاق العمل المرسل من العميل:`);
      requestScopeSummary.details.forEach((item, i) => {
        lines.push(`${i + 1}. ${item.label}: ${item.value}`);
      });
      if (requestScopeSummary.files.length > 0) lines.push(`الملفات: ${requestScopeSummary.files.join("، ")}`);
      if (requestScopeSummary.locations.length > 0) lines.push(`المواقع: ${requestScopeSummary.locations.map((l) => `${l.name} (${l.meta})`).join("، ")}`);
      if (requestScopeSummary.notes) lines.push(`ملاحظات العميل: ${requestScopeSummary.notes}`);
    }
    return lines.join("\n");
  }, [duplicateNames, removedCount, autoApproved, excluded, flagged, requestScopeSummary]);

  // Free-text message from client
  const handleFreeTextSend = useCallback(async () => {
    const hasText = freeText.trim().length > 0;
    const hasFiles = pendingAttachments.length > 0;
    if ((!hasText && !hasFiles) || isThinking) return;

    const text = freeText.trim();
    const attachments = [...pendingAttachments];
    setFreeText("");
    setPendingAttachments([]);

    const fileNames = attachments.map(a => a.name);
    const displayText = hasText && hasFiles
      ? `${text}\n📎 مرفقات: ${fileNames.join("، ")}`
      : hasText ? text : `📎 مرفقات: ${fileNames.join("، ")}`;

    setMessages(prev => [...prev, { id: `client-${Date.now()}`, type: "answer", text: displayText, timestamp: Date.now(), attachments }]);
    setIsThinking(true);

    try {
      const { data: fnData } = await supabase.functions.invoke("raqeem-client-chat", {
        body: {
          message: text || `العميل أرسل مرفقات: ${fileNames.join("، ")}`,
          conversationHistory: messages.filter(m => m.type === "answer" || m.type === "system").slice(-12),
          assetContext: assetContextStr,
          assetDetails: assetDetailsStr,
          attachments: attachments.map(a => ({ name: a.name, type: a.type, size: a.size, path: a.path })),
        },
      });

      const reply = fnData?.reply || "عذراً، حدث خطأ تقني. سأنقل استفسارك للفريق المختص.";
      setMessages(prev => [...prev, { id: `raqeem-${Date.now()}`, type: "system", text: reply, timestamp: Date.now() }]);

      if (hasText && !["من أنتم", "ترخيص", "تواصل", "خدمات", "سلام", "هلا", "شكرا"].some(k => text.includes(k))) {
        setAdditionalNotes(prev => prev ? `${prev}\n${text}` : text);
      }
      if (hasFiles) {
        setAdditionalNotes(prev => prev ? `${prev}\nمرفقات إضافية: ${fileNames.join("، ")}` : `مرفقات إضافية: ${fileNames.join("، ")}`);
      }
    } catch (err) {
      console.error("Raqeem chat error:", err);
      setMessages(prev => [...prev, { id: `raqeem-err-${Date.now()}`, type: "system", text: "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى أو التواصل معنا على 920015029.", timestamp: Date.now() }]);
    } finally {
      setIsThinking(false);
    }
  }, [freeText, isThinking, messages, assetContextStr, assetDetailsStr, pendingAttachments]);

  const initialExcluded = useMemo(() => processed.filter(a => a.license_status === "not_permitted"), [processed]);

  // Initialize chat
  useEffect(() => {
    const initial: ChatMessage[] = [];
    const clientGreeting = data.clientName ? `أهلاً وسهلاً ${data.clientName}` : "أهلاً وسهلاً بك";
    const greeting = `${clientGreeting} 👋\n\nأنا رقيم، مساعدك الذكي في ${COMPANY.name_ar}.\nمهمتي مساعدتك في مراجعة الأصول المرفقة والإجابة على استفساراتك بدقة واحترافية.\n\nراجعت المرفقات وهذا ملخص النتائج:`;
    initial.push({ id: "greeting", type: "system", text: greeting, timestamp: Date.now() });

    if (requestScopeSummary?.chatText) {
      initial.push({ id: "request-scope", type: "info", text: requestScopeSummary.chatText, timestamp: Date.now() + 1 });
    }
    if (initialExcluded.length > 0) {
      initial.push({ id: "excluded-explain", type: "info", text: buildExclusionExplanation(initialExcluded), timestamp: Date.now() + 2 });
    }
    if (questions.length > 0) {
      const reviewIntro = initialExcluded.length > 0
        ? `وأحتاج تأكيد بسيط على ${questions.length} بند آخر`
        : `${questions.length} بند يحتاج تأكيد بسيط`;
      initial.push({ id: "review-intro", type: "info", text: `❓ ${reviewIntro}`, timestamp: Date.now() + 3 });
      initial.push({ id: `q-0`, type: "question", text: questions[0].question, questionData: questions[0], timestamp: Date.now() + 4 });
    }
    if (initialExcluded.length === 0 && questions.length === 0) {
      initial.push({ id: "all-clear", type: "info", text: `✅ تم تحليل ${processed.length} بند — جميعها جاهزة للتقييم`, timestamp: Date.now() + 2 });
    }
    setMessages(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const resolveAssets = useCallback((ids: number[], status: "permitted" | "not_permitted", reason: string, updates?: Partial<ExtractedAsset>) => {
    setAssets(prev => prev.map(a => {
      if (!ids.includes(a.id)) return a;
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

  const handleApprove = () => {
    console.log("[AIReviewStep] handleApprove called", { phase, canSubmit: phase === "done" || (questions.length === 0 && phase === "final"), approvedCount: assets.filter(a => a.license_status === "permitted").length });
    onApprove(assets.filter(a => a.license_status === "permitted"), additionalNotes);
  };
  const canSubmit = phase === "done" || (questions.length === 0 && phase === "final");
  const approvedCount = autoApproved.length;
  const activeQuestion = phase === "questions" && currentQIdx < questions.length ? questions[currentQIdx] : null;
  const isLastMessage = (msgId: string) => messages.length > 0 && messages[messages.length - 1].id === msgId;

  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleAssets = assets.slice(0, visibleCount);
  const hasMore = visibleCount < assets.length;

  return (
    <div className="space-y-4">
      {requestScopeSummary && (
        <Card className="border-border/70">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">نطاق العمل المرفق من العميل</p>
                <p className="text-[11px] text-muted-foreground mt-1">تم إدراج معلومات الخطوة السابقة هنا لتبقى مرئية ضمن المراجعة نفسها.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">{requestScopeSummary.files.length} ملف</Badge>
                <Badge variant="outline" className="text-[10px]">{requestScopeSummary.locations.length} موقع</Badge>
              </div>
            </div>

            {requestScopeSummary.details.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                {requestScopeSummary.details.map((item) => (
                  <div key={item.label} className="rounded-lg border border-border bg-background px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    <p className="text-[11px] font-medium text-foreground mt-1 break-words">{item.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-background px-3 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-foreground">المواقع المرفقة</p>
                  <Badge variant="secondary" className="text-[9px]">{requestScopeSummary.locations.length}</Badge>
                </div>
                {requestScopeSummary.locations.length > 0 ? (
                  requestScopeSummary.locations.map((location, index) => (
                    <div key={`${location.name}-${index}`} className="rounded-md border border-border/70 px-2.5 py-2">
                      <p className="text-[11px] font-medium text-foreground">{location.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{location.meta}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-muted-foreground">لا توجد مواقع مرفقة.</p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-background px-3 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-foreground">الملفات والملاحظات</p>
                  <Badge variant="secondary" className="text-[9px]">{requestScopeSummary.files.length}</Badge>
                </div>
                {requestScopeSummary.files.length > 0 ? (
                  <div className="space-y-1.5">
                    {requestScopeSummary.files.map((fileName, index) => (
                      <div key={`${fileName}-${index}`} className="rounded-md border border-border/70 px-2.5 py-2 text-[11px] text-foreground break-words">
                        {fileName}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">لا توجد ملفات مرفقة.</p>
                )}
                <div className="rounded-md border border-dashed border-border px-2.5 py-2 bg-muted/20">
                  <p className="text-[10px] text-muted-foreground">ملاحظات العميل</p>
                  <p className="text-[11px] text-foreground mt-1 whitespace-pre-wrap break-words">{requestScopeSummary.notes || "لا توجد ملاحظات إضافية من العميل."}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
        <div className="max-h-[35vh] overflow-y-auto overflow-x-auto relative">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b sticky top-0 z-10 bg-background">
              <tr className="border-b transition-colors bg-muted/50">
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-[10px] w-8">#</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-[10px]">الأصل</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-[10px]">النوع</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-[10px] w-12">الكمية</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-[10px]">المصدر</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground text-[10px] w-16">الحالة</th>
              </tr>
            </thead>
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
                  <TableCell className="py-1.5 whitespace-nowrap">
                    <span className="text-[10px] text-muted-foreground">{TYPE_LABELS[asset.category ?? ""] || TYPE_LABELS[asset.type] || asset.category || (asset.type === "both" ? "—" : asset.type) || "—"}</span>
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
          </table>
        </div>
        {hasMore && (
          <button onClick={() => setVisibleCount(prev => Math.min(prev + PAGE_SIZE, assets.length))} className="w-full py-2 text-[11px] text-primary hover:bg-primary/5 border-t border-border transition-colors">
            عرض المزيد ({assets.length - visibleCount} أصل متبقي) ↓
          </button>
        )}
        {!hasMore && visibleCount > PAGE_SIZE && (
          <button onClick={() => setVisibleCount(PAGE_SIZE)} className="w-full py-2 text-[11px] text-muted-foreground hover:bg-muted/30 border-t border-border transition-colors">
            إخفاء ↑
          </button>
        )}
      </Card>

      {/* ── 3. Raqeem Chat ── */}
      <Card className="border-primary/20">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-primary/5 rounded-t-lg">
            <RaqeemAnimatedLogo size={56} />
            <span className="text-[11px] font-bold text-foreground">رقيم .. مساعدك الذكي</span>
            {phase === "questions" && questions.length > 0 && (
              <span className="text-[9px] text-muted-foreground mr-auto">{currentQIdx + 1}/{questions.length}</span>
            )}
            {phase === "done" && (
              <Badge className="mr-auto bg-emerald-500/10 text-emerald-700 border-emerald-200 text-[9px]">✓ مكتمل</Badge>
            )}
          </div>

          <div ref={chatContainerRef} className="px-4 py-3 space-y-3 max-h-[50vh] overflow-y-auto">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.type === "answer" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[92%] rounded-xl px-4 py-3 text-[13px] leading-[1.8] ${
                  msg.type === "system" ? "bg-primary/10 text-primary font-semibold"
                    : msg.type === "info" ? "bg-muted text-foreground"
                      : "bg-card text-foreground border border-border shadow-sm"
                }`}>
                  <p className="whitespace-pre-line">{msg.text}</p>

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

          {phase === "questions" && questions.length > 0 && (
            <div className="px-3 pb-2">
              <div className="bg-muted rounded-full h-1">
                <div className="bg-primary rounded-full h-1 transition-all duration-300" style={{ width: `${Math.round((currentQIdx / questions.length) * 100)}%` }} />
              </div>
            </div>
          )}

          {pendingAttachments.length > 0 && (
            <div className="px-3 pt-2 flex flex-wrap gap-1.5 border-t border-border bg-muted/10">
              {pendingAttachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-1 text-[10px]">
                  <Paperclip className="w-3 h-3" />
                  <span className="max-w-[120px] truncate">{att.name}</span>
                  <button onClick={() => removePendingAttachment(idx)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border bg-muted/20">
            <button onClick={() => chatFileRef.current?.click()} disabled={isUploading || isThinking} className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 disabled:opacity-40" title="إرفاق ملف">
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </button>
            <input ref={chatFileRef} type="file" multiple className="hidden" onChange={e => e.target.files && handleChatFileUpload(e.target.files)} />
            <Input value={freeText} onChange={e => setFreeText(e.target.value)} placeholder={pendingAttachments.length > 0 ? "أضف رسالة مع المرفقات..." : "اكتب سؤالك أو ملاحظتك لرقيم..."} className="h-8 text-[12px] flex-1 bg-background" onKeyDown={e => { if (e.key === "Enter" && (freeText.trim() || pendingAttachments.length > 0) && !isThinking) handleFreeTextSend(); }} />
            <Button size="sm" className="h-8 px-2.5 shrink-0" disabled={(!freeText.trim() && pendingAttachments.length === 0) || isThinking} onClick={handleFreeTextSend}>
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
