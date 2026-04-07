import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Sparkles, CheckCircle, RefreshCw } from "lucide-react";

interface Props {
  request: any;
  userId: string;
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

export default function ReportDraftGenerator({ request, userId }: Props) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load existing draft
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

    // Determine discipline
    const discipline = request.discipline === "real_estate" ? "real_estate"
      : request.valuation_type === "machinery" ? "machinery_equipment"
      : "real_estate";

    // Build machinery inventory from asset_data
    const machineryInventory = (assetData.inventory || [])
      .filter((a: any) => a.type === "machinery_equipment" || a.type === "medical_equipment")
      .slice(0, 50)
      .map((a: any) => ({
        name: a.name,
        type: a.type,
        condition: a.condition || "غير محددة",
      }));

    const purposeLabels: Record<string, string> = {
      sale_purchase: "البيع أو الشراء",
      financing: "التمويل العقاري",
      internal_decision: "قرار إداري داخلي",
      insurance: "التأمين",
      zakat_tax: "الزكاة والضريبة",
      liquidation: "التصفية",
      merger_acquisition: "الاندماج والاستحواذ",
    };

    return {
      assetType: request.valuation_type || "real_estate",
      discipline,
      purposeOfValuation: purposeLabels[request.purpose] || request.purpose || "تقدير القيمة السوقية",
      clientName: clientInfo.contactName || request.client_name_ar || "غير محدد",
      clientIdNumber: request.client_id_number || "",
      assetDescription: request.property_description_ar || "",
      assetLocation: request.property_address_ar || "",
      assetCity: request.property_city_ar || "",
      propertyType: request.property_type || "",
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

      // Call the edge function in structured mode
      const { data, error } = await supabase.functions.invoke("generate-report-content", {
        body: {
          mode: "structured_sections",
          context,
          sectionKeys: isMachinery
            ? ["purpose", "scope", "machinery_inventory", "market", "machinery_approaches", "machinery_calculations", "reconciliation", "assumptions", "compliance"]
            : ["purpose", "scope", "property_desc", "market", "hbu", "approaches", "calculations", "reconciliation", "assumptions", "compliance"],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.structured && data?.data) {
        // Save to report_drafts
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
      toast({
        title: "خطأ في توليد التقرير",
        description: err.message || "حاول مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            مسودة التقرير
          </span>
          {draft && (
            <Badge variant="outline" className="text-xs">
              الإصدار {draft.version}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!draft ? (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-muted-foreground">لم يتم توليد مسودة تقرير بعد لهذا الطلب</p>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {generating ? "جاري التوليد..." : "توليد مسودة التقرير"}
            </Button>
          </div>
        ) : (
          <>
            {/* Draft sections preview */}
            <ScrollArea className="max-h-96">
              <div className="space-y-3">
                {Object.entries(draft.sections || {}).map(([key, value]) => {
                  const label = SECTION_LABELS[key];
                  if (!label || !value) return null;
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                        <p className="text-xs font-semibold text-foreground">{label}</p>
                      </div>
                      <p className="text-xs text-muted-foreground leading-6 bg-muted/30 rounded p-2 whitespace-pre-wrap line-clamp-4">
                        {String(value)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <Separator />

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating} className="gap-1 flex-1">
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                إعادة التوليد
              </Button>
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
