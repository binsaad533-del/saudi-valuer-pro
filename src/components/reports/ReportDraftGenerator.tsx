import { useState, useEffect } from "react";
import BidiText from "@/components/ui/bidi-text";
import { supabase } from "@/integrations/supabase/client";
import { changeStatusByRequestId } from "@/lib/workflow-status";
import { updateReportDraftStatus } from "@/lib/report-draft-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { analyzeDiscipline } from "@/lib/asset-discipline-engine";
import {
  Loader2, FileText, Sparkles, CheckCircle, RefreshCw,
  Send, ThumbsUp, ClipboardCheck, Building2, BarChart3,
  Scale, BookOpen, Calculator, Layers, ListChecks,
  ShieldCheck, Wrench,
} from "lucide-react";

interface Props {
  request: any;
  userId: string;
  onStatusChange?: () => void;
}

const SECTION_META: Record<string, { label: string; icon: React.ElementType }> = {
  purpose_ar:              { label: "الغرض من التقييم", icon: ClipboardCheck },
  scope_ar:                { label: "نطاق العمل", icon: FileText },
  property_desc_ar:        { label: "وصف الأصل", icon: Building2 },
  market_ar:               { label: "تحليل السوق", icon: BarChart3 },
  hbu_ar:                  { label: "الاستخدام الأعلى والأفضل", icon: Scale },
  approaches_ar:           { label: "أساليب التقييم", icon: BookOpen },
  calculations_ar:         { label: "الحسابات والتحليل", icon: Calculator },
  reconciliation_ar:       { label: "التسوية والمطابقة", icon: Layers },
  assumptions_ar:          { label: "الافتراضات والشروط", icon: ListChecks },
  compliance_ar:           { label: "بيان الامتثال", icon: ShieldCheck },
  machinery_inventory_ar:  { label: "جرد الآلات والمعدات", icon: Wrench },
  machinery_approaches_ar: { label: "أساليب تقييم المعدات", icon: Wrench },
  machinery_calculations_ar: { label: "حسابات تقييم المعدات", icon: Calculator },
  unified_summary_ar:      { label: "الملخص الموحد", icon: FileText },
};

export default function ReportDraftGenerator({ request, userId, onStatusChange }: Props) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [sendingToClient, setSendingToClient] = useState(false);

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
    const analysis = analyzeDiscipline(inventory, assetData.discipline || request.discipline, request.valuation_type);
    const machineryInventory = inventory
      .filter((a: any) => a.type !== "real_estate")
      .slice(0, 50)
      .map((a: any) => ({ name: a.name, type: a.type, condition: a.condition || "غير محددة", value: a.value }));
    const purposeLabels: Record<string, string> = {
      sale_purchase: "البيع أو الشراء", financing: "التمويل العقاري",
      internal_decision: "قرار إداري داخلي", insurance: "التأمين",
      zakat_tax: "الزكاة والضريبة", liquidation: "التصفية",
      merger_acquisition: "الاندماج والاستحواذ", investment: "الاستثمار",
    };
    return {
      assetType: analysis.discipline, discipline: analysis.discipline,
      purposeOfValuation: purposeLabels[request.purpose] || request.purpose || "تقدير القيمة السوقية",
      clientName: clientInfo.contactName || request.client_name_ar || "غير محدد",
      clientIdNumber: request.client_id_number || "",
      assetDescription: analysis.assetDescription || request.property_description_ar || analysis.disciplineLabel,
      assetLocation: request.property_address_ar || (request.ai_intake_summary?.locations?.[0]?.name) || (request.ai_intake_summary?.locations?.[0]?.googleMapsUrl) || "",
      assetCity: request.property_city_ar || (request.ai_intake_summary?.locations?.[0]?.city) || "",
      propertyType: analysis.disciplineLabel,
      methodology: analysis.methodologies[0] || "",
      landArea: request.land_area?.toString() || "",
      buildingArea: request.building_area?.toString() || "",
      estimatedValue: request.quotation_amount || 0,
      valuationDate: new Date().toISOString().split("T")[0],
      machineryInventory, totalValue: request.quotation_amount || 0,
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
          mode: "structured_sections", context,
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
            request_id: request.id, generated_by: userId, status: "draft",
            sections: data.data.sections || data.data, ai_model: "gemini-2.5-flash",
            generation_mode: "structured_sections", version: newVersion,
          } as any)
          .select().single();
        if (saveErr) throw saveErr;
        setDraft(saved);
        toast({ title: "تم توليد المسودة بنجاح ✨", description: `الإصدار ${newVersion}` });
      }
    } catch (err: any) {
      console.error("Report generation error:", err);
      toast({ title: "خطأ في توليد التقرير", description: err.message || "حاول مرة أخرى", variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const handleApproveDraft = async () => {
    setApproving(true);
    try {
      const draftResult = await updateReportDraftStatus(draft.id, "approved");
      if (!draftResult.success) throw new Error(draftResult.error);
      const statusResult = await changeStatusByRequestId(request.id, "draft_report_ready", { reason: "اعتماد المسودة من المقيّم" });
      if (!statusResult.success) throw new Error(statusResult.error);
      setDraft({ ...draft, status: "approved" });
      toast({ title: "تم اعتماد المسودة ✅", description: "المسودة جاهزة للإرسال للعميل" });
      onStatusChange?.();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally { setApproving(false); }
  };

  const handleSendToClient = async () => {
    setSendingToClient(true);
    try {
      const statusResult = await changeStatusByRequestId(request.id, "client_review", { reason: "إرسال المسودة للعميل" });
      if (!statusResult.success) throw new Error(statusResult.error);
      const draftResult = await updateReportDraftStatus(draft.id, "sent_to_client");
      if (!draftResult.success) throw new Error(draftResult.error);
      await supabase.from("request_messages").insert({
        request_id: request.id, sender_type: "admin" as const, sender_id: userId,
        content: "📄 تم إرسال مسودة التقرير للمراجعة. يرجى الاطلاع وإبداء الملاحظات.",
      });
      setDraft({ ...draft, status: "sent_to_client" });
      toast({ title: "تم الإرسال للعميل 📤", description: "سيتم إشعار العميل بالمسودة" });
      onStatusChange?.();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally { setSendingToClient(false); }
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

  const sectionEntries = draft
    ? Object.entries(draft.sections || {}).filter(([key, value]) => SECTION_META[key] && value)
    : [];

  return (
    <Card dir="rtl">
      {/* ═══ HEADER ═══ */}
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">مسودة التقرير</h2>
              {draft && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sectionEntries.length} قسم • الإصدار {draft.version} • {new Date(draft.created_at).toLocaleDateString("ar-SA")}
                </p>
              )}
            </div>
          </div>
          {draft && (
            <Badge
              className={`border-0 text-xs font-semibold px-3 py-1 ${
                isSentToClient
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : isDraftApproved
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}
            >
              {isSentToClient ? "أُرسل للعميل" : isDraftApproved ? "معتمد" : `مسودة v${draft.version}`}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ═══ DRAFT LEGAL DISCLAIMER (IVS 106 / TAQEEM) ═══ */}
        {draft && !isSentToClient && (
          <div className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-lg">⚠️</span>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  مسودة مبدئية للاستخدام الداخلي فقط — DRAFT
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  هذا الرأي مؤقت، مخصص لأغراض المراجعة الداخلية للعميل، ولا يجوز نشره أو الاعتماد عليه قانونياً.
                  لا يُعد هذا التقرير نهائياً إلا بعد اعتماده من المقيّم المعتمد وإصداره بالتوقيع الإلكتروني ورقم الإيداع.
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  وفقاً لمعيار التقييم الدولي IVS 106 ومعايير الهيئة السعودية للمقيّمين المعتمدين (تقييم)
                </p>
              </div>
            </div>
          </div>
        )}

        {!draft ? (
          /* ═══ NO DRAFT ═══ */
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">لم يتم توليد مسودة تقرير بعد</p>
              <p className="text-xs text-muted-foreground mt-1">اضغط لتوليد مسودة التقرير باستخدام الذكاء الاصطناعي</p>
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2" size="lg">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "جاري التوليد..." : "توليد مسودة التقرير"}
            </Button>
          </div>
        ) : (
          <>
            {/* ═══ SECTIONS ACCORDION ═══ */}
            <Accordion type="multiple" className="space-y-2">
              {sectionEntries.map(([key, value]) => {
                const meta = SECTION_META[key];
                if (!meta) return null;
                const Icon = meta.icon;
                const textContent = String(value);
                const previewText = textContent.length > 120 ? textContent.slice(0, 120) + "…" : textContent;

                return (
                  <AccordionItem
                    key={key}
                    value={key}
                    className="border border-border/60 rounded-xl overflow-hidden data-[state=open]:ring-1 data-[state=open]:ring-primary/20 transition-all"
                  >
                    <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-sm font-bold text-foreground">{meta.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{previewText}</p>
                        </div>
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 opacity-50" />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="px-4 pb-4 pt-1">
                        <Separator className="mb-4" />
                        <div className="readable-width">
                          <BidiText
                            className="text-sm text-foreground/90 leading-[2]"
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

            <Separator />

            {/* ═══ ACTIONS ═══ */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating || isSentToClient} className="gap-2 flex-1">
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  إعادة التوليد
                </Button>
              </div>

              {!isDraftApproved && !isSentToClient && (
                <Button
                  onClick={handleApproveDraft}
                  disabled={approving}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                  اعتماد المسودة
                </Button>
              )}

              {isDraftApproved && !isSentToClient && (
                <Button
                  onClick={handleSendToClient}
                  disabled={sendingToClient}
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {sendingToClient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  إرسال المسودة للعميل
                </Button>
              )}

              {isSentToClient && (
                <div className="text-center py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-center gap-2">
                    <Send className="w-3.5 h-3.5" />
                    تم إرسال المسودة للعميل — بانتظار الملاحظات
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
