import { useState, useEffect } from "react";
import BidiText from "@/components/ui/bidi-text";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { analyzeDiscipline } from "@/lib/asset-discipline-engine";
import {
  Loader2,
  FileText,
  Sparkles,
  CheckCircle,
  RefreshCw,
  Send,
  ThumbsUp,
  Eye,
} from "lucide-react";

interface Props {
  request: any;
  userId: string;
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

export default function ReportDraftGenerator({ request, userId, onStatusChange }: Props) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [sendingToClient, setSendingToClient] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("report_drafts" as any)
        .select("*")
        .eq("request_id", request.id)
        .order("version", { ascending: false })
        .limit(1);
      if (data && data.length > 0) setDraft(data[0]);
      setLoading(false);
    };
    load();
  }, [request.id]);

  const buildContext = () => {
    const intake = request.ai_intake_summary || {};
    const assetData = request.asset_data || {};
    const clientInfo = intake.clientInfo || {};
    const inventory = Array.isArray(assetData.inventory) ? assetData.inventory : [];

    // Smart discipline detection from actual assets
    const analysis = analyzeDiscipline(
      inventory,
      assetData.discipline || request.discipline,
      request.valuation_type
    );

    const machineryInventory = inventory
      .filter((a: any) => a.type !== "real_estate")
      .slice(0, 50)
      .map((a: any) => ({
        name: a.name,
        type: a.type,
        condition: a.condition || "غير محددة",
        value: a.value,
      }));

    const purposeLabels: Record<string, string> = {
      sale_purchase: "البيع أو الشراء",
      financing: "التمويل العقاري",
      internal_decision: "قرار إداري داخلي",
      insurance: "التأمين",
      zakat_tax: "الزكاة والضريبة",
      liquidation: "التصفية",
      merger_acquisition: "الاندماج والاستحواذ",
      investment: "الاستثمار",
    };

    return {
      assetType: analysis.discipline,
      discipline: analysis.discipline,
      purposeOfValuation: purposeLabels[request.purpose] || request.purpose || "تقدير القيمة السوقية",
      clientName: clientInfo.contactName || request.client_name_ar || "غير محدد",
      clientIdNumber: request.client_id_number || "",
      assetDescription: analysis.assetDescription || request.property_description_ar || analysis.disciplineLabel,
      assetLocation: request.property_address_ar || "",
      assetCity: request.property_city_ar || "",
      propertyType: analysis.disciplineLabel,
      methodology: analysis.methodologies[0] || "",
      landArea: request.land_area?.toString() || "",
      buildingArea: request.building_area?.toString() || "",
      estimatedValue: request.quotation_amount || 0,
      valuationDate: new Date().toISOString().split("T")[0],
      machineryInventory,
      totalValue: request.quotation_amount || 0,
    };
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const context = buildContext();
      const isMachinery = context.discipline === "machinery_equipment";
      const isMixed = context.discipline === "mixed";
      const { data, error } = await supabase.functions.invoke("generate-report-content", {
        body: {
          mode: "structured_sections",
          context,
          sectionKeys: isMixed
            ? ["purpose", "scope", "property_desc", "market", "hbu", "approaches", "calculations", "machinery_inventory", "machinery_approaches", "machinery_calculations", "unified_summary", "reconciliation", "assumptions", "compliance"]
            : isMachinery
            ? ["purpose", "scope", "machinery_inventory", "market", "machinery_approaches", "machinery_calculations", "reconciliation", "assumptions", "compliance"]
            : ["purpose", "scope", "property_desc", "market", "hbu", "approaches", "calculations", "reconciliation", "assumptions", "compliance"],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.structured && data?.data) {
        const newVersion = (draft?.version || 0) + 1;
        const { data: saved, error: saveErr } = await supabase
          .from("report_drafts" as any)
          .insert({
            request_id: request.id,
            generated_by: userId,
            status: "draft",
            sections: data.data.sections || data.data,
            ai_model: "gemini-2.5-flash",
            generation_mode: "structured_sections",
            version: newVersion,
          } as any)
          .select()
          .single();
        if (saveErr) throw saveErr;
        setDraft(saved);
        toast({ title: "تم توليد المسودة بنجاح ✨", description: `الإصدار ${newVersion}` });
      }
    } catch (err: any) {
      console.error("Report generation error:", err);
      toast({ title: "خطأ في توليد التقرير", description: err.message || "حاول مرة أخرى", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveDraft = async () => {
    setApproving(true);
    try {
      // Update draft status
      await supabase
        .from("report_drafts" as any)
        .update({ status: "approved" } as any)
        .eq("id", draft.id);

      // Update request status to draft_report_ready
      await supabase
        .from("valuation_requests" as any)
        .update({ status: "draft_report_ready", updated_at: new Date().toISOString() } as any)
        .eq("id", request.id);

      setDraft({ ...draft, status: "approved" });
      toast({ title: "تم اعتماد المسودة ✅", description: "المسودة جاهزة للإرسال للعميل" });
      onStatusChange?.();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  const handleSendToClient = async () => {
    setSendingToClient(true);
    try {
      // Update request status
      await supabase
        .from("valuation_requests" as any)
        .update({ status: "draft_report_sent", updated_at: new Date().toISOString() } as any)
        .eq("id", request.id);

      // Update draft status
      await supabase
        .from("report_drafts" as any)
        .update({ status: "sent_to_client" } as any)
        .eq("id", draft.id);

      // Send notification message in chat
      await supabase.from("request_messages").insert({
        request_id: request.id,
        sender_type: "admin" as const,
        sender_id: userId,
        content: "📄 تم إرسال مسودة التقرير للمراجعة. يرجى الاطلاع وإبداء الملاحظات.",
      });

      setDraft({ ...draft, status: "sent_to_client" });
      toast({ title: "تم الإرسال للعميل 📤", description: "سيتم إشعار العميل بالمسودة" });
      onStatusChange?.();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSendingToClient(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isDraftApproved = draft?.status === "approved";
  const isSentToClient = draft?.status === "sent_to_client";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            مسودة التقرير
          </span>
          {draft && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  isSentToClient
                    ? "bg-blue-500/10 text-blue-600 border-blue-200"
                    : isDraftApproved
                    ? "bg-green-500/10 text-green-600 border-green-200"
                    : "bg-amber-500/10 text-amber-600 border-amber-200"
                }
              >
                {isSentToClient ? "أُرسل للعميل" : isDraftApproved ? "معتمد" : `مسودة v${draft.version}`}
              </Badge>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!draft ? (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-muted-foreground">لم يتم توليد مسودة تقرير بعد</p>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "جاري التوليد..." : "توليد مسودة التقرير"}
            </Button>
          </div>
        ) : (
          <>
            {/* Sections preview */}
            <ScrollArea className={expanded ? "max-h-[600px]" : "max-h-48"}>
              <div className="space-y-2">
                {Object.entries(draft.sections || {}).map(([key, value]) => {
                  const label = SECTION_LABELS[key];
                  if (!label || !value) return null;
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                        <p className="text-xs font-semibold text-foreground">{label}</p>
                      </div>
                      <BidiText className="text-xs text-muted-foreground bg-muted/30 rounded p-2" lineClamp={3} preserveNewlines>
                        {String(value)}
                      </BidiText>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setExpanded(!expanded)}>
              <Eye className="w-3 h-3 ml-1" />
              {expanded ? "عرض أقل" : "عرض المزيد"}
            </Button>

            <Separator />

            {/* Action buttons */}
            <div className="space-y-2">
              {/* Row 1: Regenerate */}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating || isSentToClient} className="gap-1 flex-1">
                  {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  إعادة التوليد
                </Button>
              </div>

              {/* Row 2: Approve + Send */}
              {!isDraftApproved && !isSentToClient && (
                <Button
                  size="sm"
                  onClick={handleApproveDraft}
                  disabled={approving}
                  className="w-full gap-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {approving ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />}
                  اعتماد المسودة
                </Button>
              )}

              {isDraftApproved && !isSentToClient && (
                <Button
                  size="sm"
                  onClick={handleSendToClient}
                  disabled={sendingToClient}
                  className="w-full gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {sendingToClient ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  إرسال المسودة للعميل
                </Button>
              )}

              {isSentToClient && (
                <div className="text-center py-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-center gap-1">
                    <Send className="w-3 h-3" />
                    تم إرسال المسودة للعميل بانتظار الملاحظات
                  </p>
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              تم التوليد: {new Date(draft.created_at).toLocaleString("ar-SA")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
