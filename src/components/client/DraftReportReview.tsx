import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, FileText, CheckCircle, MessageSquareText,
  ThumbsUp, AlertTriangle, Eye, ChevronDown, ChevronUp,
} from "lucide-react";

interface Props {
  requestId: string;
  userId: string;
  paymentStructure?: string;
  onStatusChange?: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  purpose_ar: "الغرض من التقييم",
  scope_ar: "نطاق العمل",
  property_desc_ar: "وصف الأصل",
  market_ar: "تحليل السوق",
  hbu_ar: "الاستخدام الأعلى والأفضل",
  approaches_ar: "أساليب التقييم",
  calculations_ar: "الحسابات والتحليل",
  reconciliation_ar: "التسوية والمطابقة",
  assumptions_ar: "الافتراضات والشروط",
  compliance_ar: "بيان الامتثال",
  machinery_inventory_ar: "جرد الآلات والمعدات",
  machinery_approaches_ar: "أساليب تقييم المعدات",
  machinery_calculations_ar: "حسابات تقييم المعدات",
  unified_summary_ar: "الملخص الموحد",
};

export default function DraftReportReview({ requestId, userId, paymentStructure, onStatusChange }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
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
          request_id: requestId,
          sender_type: "system" as any,
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
          request_id: requestId,
          sender_type: "client" as any,
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
      <Card className="shadow-card">
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!draft) return null;

  const sections = draft.sections || {};
  const sectionEntries = Object.entries(sections).filter(
    ([key, value]) => SECTION_LABELS[key] && value
  );

  return (
    <Card className="shadow-card border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            مسودة التقرير للمراجعة
          </span>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
            الإصدار {draft.version}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* DRAFT watermark banner */}
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-center">
          <p className="text-amber-700 dark:text-amber-300 font-bold text-sm opacity-60">DRAFT / مسودة</p>
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
            هذه مسودة للمراجعة فقط — التقرير النهائي سيصدر بعد الاعتماد
          </p>
        </div>

        {/* Sections */}
        <ScrollArea className={expanded ? "max-h-[500px]" : "max-h-48"}>
          <div className="space-y-3">
            {sectionEntries.map(([key, value]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                  <p className="text-xs font-semibold text-foreground">{SECTION_LABELS[key]}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-6 bg-muted/30 rounded p-2 whitespace-pre-wrap line-clamp-4">
                  {String(value)}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>

        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          {expanded ? "عرض أقل" : `عرض كل الأقسام (${sectionEntries.length})`}
        </Button>

        <Separator />

        {hasResponded ? (
          <div className="text-center py-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <p className="text-xs text-green-700 dark:text-green-300">تم إرسال ردك بنجاح</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Approve button */}
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={submitting}
              className="w-full gap-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />}
              اعتماد المسودة والمتابعة
            </Button>

            {/* Comments section */}
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquareText className="w-3 h-3" />
                <span>أو أضف ملاحظاتك لطلب تعديل</span>
              </div>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="اكتب ملاحظاتك على المسودة هنا..."
                className="text-xs min-h-[80px]"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleRequestRevision}
                disabled={submitting || !comments.trim()}
                className="w-full gap-1"
              >
                {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                إرسال ملاحظات وطلب تعديل
              </Button>
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          تاريخ الإرسال: {new Date(draft.created_at).toLocaleString("ar-SA")}
        </p>
      </CardContent>
    </Card>
  );
}
