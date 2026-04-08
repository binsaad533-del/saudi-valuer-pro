import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";

interface Props {
  requestId: string;
  userId: string;
  paymentStructure?: string;
  onStatusChange?: () => void;
}

const SECTION_META: Record<string, { label: string; icon: React.ElementType; preview: string }> = {
  purpose_ar: { label: "الغرض من التقييم", icon: ClipboardCheck, preview: "تحديد الغرض والأساس والمعايير المعتمدة" },
  scope_ar: { label: "نطاق العمل", icon: FileText, preview: "حدود التقييم والافتراضات والمخرجات" },
  property_desc_ar: { label: "وصف الأصل", icon: Building2, preview: "الموقع والمواصفات والحالة الفنية" },
  market_ar: { label: "تحليل السوق", icon: BarChart3, preview: "العرض والطلب والعوامل المؤثرة" },
  hbu_ar: { label: "الاستخدام الأعلى والأفضل", icon: Scale, preview: "التحليل القانوني والمادي والمالي" },
  approaches_ar: { label: "أساليب التقييم", icon: BookOpen, preview: "المنهجيات المطبقة والمبررات" },
  calculations_ar: { label: "الحسابات والتحليل", icon: Calculator, preview: "تفاصيل العمليات الحسابية والنتائج" },
  reconciliation_ar: { label: "التسوية والمطابقة", icon: Layers, preview: "مقارنة النتائج والقيمة النهائية" },
  assumptions_ar: { label: "الافتراضات والشروط", icon: ListChecks, preview: "الافتراضات العامة والخاصة" },
  compliance_ar: { label: "بيان الامتثال", icon: ShieldCheck, preview: "الامتثال للمعايير الدولية والمحلية" },
  machinery_inventory_ar: { label: "جرد الآلات والمعدات", icon: Wrench, preview: "قائمة الأصول المنقولة" },
  machinery_approaches_ar: { label: "أساليب تقييم المعدات", icon: Wrench, preview: "منهجيات تقييم الأصول المنقولة" },
  machinery_calculations_ar: { label: "حسابات تقييم المعدات", icon: Calculator, preview: "حسابات الإهلاك والقيمة" },
  unified_summary_ar: { label: "الملخص الموحد", icon: FileText, preview: "ملخص شامل للتقييم والنتائج" },
};

export default function DraftReportReview({ requestId, userId, paymentStructure, onStatusChange }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("report_drafts" as any)
        .select("*")
        .eq("request_id", requestId)
        .eq("status", "sent_to_client")
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
      const nextStatus = needsFinalPayment ? "final_payment_pending" : "final_report_ready";
      await Promise.all([
        supabase.from("report_drafts" as any)
          .update({ status: "client_approved", client_approved_at: new Date().toISOString() } as any)
          .eq("id", draft.id),
        supabase.from("valuation_requests" as any)
          .update({ status: nextStatus, updated_at: new Date().toISOString() } as any)
          .eq("id", requestId),
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
      await Promise.all([
        supabase.from("report_drafts" as any)
          .update({ status: "client_revision_requested", client_comments: comments } as any)
          .eq("id", draft.id),
        supabase.from("valuation_requests" as any)
          .update({ status: "client_comments", updated_at: new Date().toISOString() } as any)
          .eq("id", requestId),
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
      <div className="py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!draft) return null;

  const sections = draft.sections || {};
  const sectionEntries = Object.entries(sections).filter(
    ([key, value]) => SECTION_META[key] && value
  );
  const isMachineryDraft = Boolean(
    sections.machinery_inventory_ar || sections.machinery_approaches_ar || sections.machinery_calculations_ar
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">مسودة التقرير</h2>
            <p className="text-xs text-muted-foreground">
              {isMachineryDraft ? "تقرير آلات ومعدات" : "تقرير تقييم"} • الإصدار {draft.version}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-xs">
            مسودة للمراجعة
          </Badge>
          <Badge variant="outline" className="text-xs">
            {sectionEntries.length} قسم
          </Badge>
        </div>
      </div>

      {/* Sections Accordion */}
      <Accordion type="multiple" className="space-y-2">
        {sectionEntries.map(([key, value], index) => {
          const meta = SECTION_META[key];
          const Icon = meta.icon;
          const textContent = String(value);
          const previewText = textContent.length > 120 ? textContent.slice(0, 120) + "..." : textContent;

          return (
            <AccordionItem
              key={key}
              value={key}
              className="border border-border/60 rounded-xl overflow-hidden bg-card shadow-sm data-[state=open]:shadow-md transition-shadow"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 transition-colors [&[data-state=open]]:bg-muted/20">
                <div className="flex items-center gap-3 flex-1 min-w-0" dir="rtl">
                  <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{meta.preview}</p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                <div className="border-t border-border/40 pt-4">
                  <BidiText
                    className="text-sm text-foreground/90 leading-[2] bg-muted/20 rounded-lg p-4"
                    preserveNewlines
                  >
                    {textContent}
                  </BidiText>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Actions */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        {hasResponded ? (
          <div className="text-center py-4">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">تم إرسال ردك بنجاح</p>
            <p className="text-xs text-muted-foreground mt-1">سيتم إشعارك بالخطوة التالية</p>
          </div>
        ) : (
          <>
            <Button
              size="lg"
              onClick={handleApprove}
              disabled={submitting}
              className="w-full gap-2 text-sm font-semibold h-12"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
              اعتماد المسودة والمتابعة
            </Button>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquareText className="w-3.5 h-3.5" />
                <span>أو أضف ملاحظاتك لطلب تعديل على المسودة</span>
              </div>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="اكتب ملاحظاتك على المسودة هنا..."
                className="text-sm min-h-[100px] leading-[1.8]"
                dir="rtl"
              />
              <Button
                variant="outline"
                onClick={handleRequestRevision}
                disabled={submitting || !comments.trim()}
                className="w-full gap-2 text-sm"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                إرسال ملاحظات وطلب تعديل
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <p className="text-[11px] text-muted-foreground text-center">
        تاريخ الإرسال: {new Date(draft.created_at).toLocaleString("ar-SA")}
      </p>
    </div>
  );
}
