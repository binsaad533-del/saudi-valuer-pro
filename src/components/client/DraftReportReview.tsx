import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { changeStatusByRequestId } from "@/lib/workflow-status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import BidiText from "@/components/ui/bidi-text";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Loader2, FileText, CheckCircle, MessageSquareText,
  ThumbsUp, AlertTriangle, ClipboardCheck, Scale,
  BarChart3, Building2, BookOpen, Calculator,
  ShieldCheck, ListChecks, Wrench, Layers,
  Calendar, Hash, FolderOpen, RefreshCw, X,
} from "lucide-react";

interface Props {
  requestId: string;
  userId: string;
  paymentStructure?: string;
  onStatusChange?: () => void;
}

const SECTION_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  purpose_ar:              { label: "الغرض من التقييم", icon: ClipboardCheck, color: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30" },
  scope_ar:                { label: "نطاق العمل", icon: FileText, color: "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30" },
  property_desc_ar:        { label: "وصف الأصل", icon: Building2, color: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30" },
  market_ar:               { label: "تحليل السوق", icon: BarChart3, color: "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30" },
  hbu_ar:                  { label: "الاستخدام الأعلى والأفضل", icon: Scale, color: "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30" },
  approaches_ar:           { label: "أساليب التقييم", icon: BookOpen, color: "text-teal-600 bg-teal-100 dark:text-teal-400 dark:bg-teal-900/30" },
  calculations_ar:         { label: "الحسابات والتحليل", icon: Calculator, color: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30" },
  reconciliation_ar:       { label: "التسوية والمطابقة", icon: Layers, color: "text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900/30" },
  assumptions_ar:          { label: "الافتراضات والشروط", icon: ListChecks, color: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30" },
  compliance_ar:           { label: "بيان الامتثال", icon: ShieldCheck, color: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30" },
  machinery_inventory_ar:  { label: "جرد الآلات والمعدات", icon: Wrench, color: "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30" },
  machinery_approaches_ar: { label: "أساليب تقييم المعدات", icon: Wrench, color: "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30" },
  machinery_calculations_ar: { label: "حسابات تقييم المعدات", icon: Calculator, color: "text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/30" },
  unified_summary_ar:      { label: "الملخص الموحد", icon: FileText, color: "text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/30" },
};

export default function DraftReportReview({ requestId, userId, paymentStructure, onStatusChange }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const [showRevisionPanel, setShowRevisionPanel] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Try to find the latest draft that was sent to client or is in review
      const { data } = await supabase
        .from("report_drafts" as any)
        .select("*")
        .eq("request_id", requestId)
        .in("status", ["sent_to_client", "approved", "client_approved", "client_revision_requested", "draft"])
        .order("version", { ascending: false })
        .limit(1);
      if (data && data.length > 0) setDraft(data[0]);
      setLoading(false);
    };
    load();
  }, [requestId]);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const needsFinalPayment = paymentStructure === "partial";
      const nextStatus = needsFinalPayment ? "draft_approved" : "draft_approved";
      const statusResult = await changeStatusByRequestId(requestId, nextStatus, { reason: "اعتماد المسودة من العميل" });
      if (!statusResult.success) throw new Error(statusResult.error);
      await Promise.all([
        supabase.from("report_drafts" as any)
          .update({ status: "client_approved", client_approved_at: new Date().toISOString() } as any)
          .eq("id", draft.id),
        supabase.from("request_messages" as any).insert({
          request_id: requestId, sender_type: "system" as any,
          content: needsFinalPayment
            ? "✅ وافق العميل على مسودة التقرير. بانتظار الدفعة النهائية لإصدار التقرير الرسمي."
            : "✅ وافق العميل على مسودة التقرير. جاري إعداد التقرير النهائي.",
        }),
      ]);
      setHasResponded(true);
      toast({ title: "تم اعتماد المسودة ✅", description: needsFinalPayment ? "يرجى سداد الدفعة النهائية" : "جاري إعداد التقرير النهائي" });
      onStatusChange?.();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!comments.trim()) {
      toast({ title: "يرجى كتابة ملاحظاتك", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const statusResult = await changeStatusByRequestId(requestId, "client_review", { reason: "ملاحظات العميل على المسودة" });
      if (!statusResult.success) console.warn("Status change warning:", statusResult.error);
      await Promise.all([
        supabase.from("report_drafts" as any)
          .update({ status: "client_revision_requested", client_comments: comments } as any)
          .eq("id", draft.id),
        supabase.from("request_messages" as any).insert({
          request_id: requestId, sender_type: "client" as any,
          sender_id: userId,
          content: `📝 ملاحظات على المسودة:\n${comments}`,
        }),
      ]);
      setHasResponded(true);
      toast({ title: "تم إرسال ملاحظاتك 📝", description: "سيتم مراجعتها من قبل المقيّم" });
      onStatusChange?.();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">جاري تحميل المسودة...</p>
      </div>
    );
  }

  if (!draft) {
    return (
      <div dir="rtl" className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <FileText className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">مسودة التقرير قيد الإعداد</p>
        <p className="text-xs text-muted-foreground">سيتم إشعارك فور جاهزية المسودة للمراجعة</p>
      </div>
    );
  }

  const sections = draft.sections || {};
  const sectionEntries = Object.entries(sections).filter(
    ([key, value]) => SECTION_META[key] && value
  );
  const isMachineryDraft = Boolean(
    sections.machinery_inventory_ar || sections.machinery_approaches_ar || sections.machinery_calculations_ar
  );
  const completedSections = sectionEntries.length;
  const draftDate = new Date(draft.created_at).toLocaleDateString("ar-SA", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div dir="rtl" className="space-y-0">

      {/* ═══════════════ HEADER ═══════════════ */}
      <div className="rounded-t-2xl border border-border bg-card px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">مسودة التقرير</h1>
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs font-semibold px-3 py-0.5">
                  مسودة v{draft.version}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {isMachineryDraft ? "تقرير آلات ومعدات" : "تقرير تقييم عقاري"} • بانتظار مراجعتك واعتمادك
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ QUICK INFO CHIPS ═══════════════ */}
      <div className="border-x border-border bg-muted/20 px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>{draftDate}</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Hash className="w-3.5 h-3.5" />
            <span>الإصدار {draft.version}</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{completedSections} قسم</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">مكتمل</span>
          </div>
        </div>
      </div>

      {/* ═══════════════ SECTIONS ACCORDION ═══════════════ */}
      <div className="border-x border-border bg-card px-6 py-5">
        <Accordion type="multiple" className="space-y-3">
          {sectionEntries.map(([key, value]) => {
            const meta = SECTION_META[key];
            const Icon = meta.icon;
            const textContent = String(value);
            const previewText = textContent.length > 100 ? textContent.slice(0, 100) + "…" : textContent;
            const colorClasses = meta.color.split(" ");
            const textColor = colorClasses.filter(c => c.startsWith("text-")).join(" ");
            const bgColor = colorClasses.filter(c => c.startsWith("bg-") || c.startsWith("dark:bg-")).join(" ");

            return (
              <AccordionItem
                key={key}
                value={key}
                className="border border-border/50 rounded-xl overflow-hidden bg-background data-[state=open]:ring-1 data-[state=open]:ring-primary/20 transition-all"
              >
                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-xl ${bgColor} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-[18px] h-[18px] ${textColor}`} />
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-sm font-bold text-foreground">{meta.label}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{previewText}</p>
                    </div>
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 opacity-60" />
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-5 pb-5 pt-1">
                    <div className="border-t border-border/30 pt-4">
                      <BidiText
                        className="text-[13px] text-foreground/85 leading-[2.1]"
                        preserveNewlines
                      >
                        {textContent}
                      </BidiText>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* ═══════════════ ACTIONS FOOTER ═══════════════ */}
      <div className="rounded-b-2xl border border-t-0 border-border bg-card px-6 py-5">
        {draft.status === "client_approved" ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-base font-bold text-foreground">تم اعتماد المسودة</p>
            <p className="text-sm text-muted-foreground mt-1">جاري إعداد التقرير النهائي</p>
          </div>
        ) : draft.status === "client_revision_requested" ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
              <RefreshCw className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-base font-bold text-foreground">تم إرسال ملاحظاتك</p>
            <p className="text-sm text-muted-foreground mt-1">المقيّم يعمل على تعديل المسودة</p>
          </div>
        ) : hasResponded ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-base font-bold text-foreground">تم إرسال ردك بنجاح</p>
            <p className="text-sm text-muted-foreground mt-1">سيتم إشعارك بالخطوة التالية</p>
          </div>
        ) : ["sent_to_client", "draft", "approved"].includes(draft.status) ? (
          <div className="space-y-4">
            {/* Primary Action */}
            <Button
              size="lg"
              onClick={handleApprove}
              disabled={submitting}
              className="w-full gap-2 text-sm font-bold h-12 rounded-xl"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
              اعتماد المسودة والمتابعة
            </Button>

            {/* Revision Toggle */}
            {!showRevisionPanel ? (
              <button
                onClick={() => setShowRevisionPanel(true)}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-2"
              >
                <MessageSquareText className="w-3.5 h-3.5" />
                لديك ملاحظات؟ اطلب تعديل على المسودة
              </button>
            ) : (
              <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MessageSquareText className="w-4 h-4 text-primary" />
                    ملاحظاتك على المسودة
                  </div>
                  <button onClick={() => setShowRevisionPanel(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="اكتب ملاحظاتك هنا بالتفصيل..."
                  className="text-sm min-h-[120px] leading-[1.9] rounded-lg"
                  dir="rtl"
                />
                <Button
                  variant="outline"
                  onClick={handleRequestRevision}
                  disabled={submitting || !comments.trim()}
                  className="w-full gap-2 text-sm rounded-lg"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  إرسال الملاحظات وطلب تعديل
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">المسودة قيد المراجعة الداخلية — ستُتاح لك خيارات الاعتماد فور إرسالها رسمياً</p>
          </div>
        )}
      </div>
    </div>
  );
}
