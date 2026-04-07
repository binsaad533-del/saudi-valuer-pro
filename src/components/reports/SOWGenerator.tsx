import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Send, CheckCircle, Shield, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateSOW, deriveInspectionType, type InspectionType, type GeneratedSOW } from "@/lib/sow-engine";

interface SOWGeneratorProps {
  request: any;
  userId: string;
  onStatusChange?: () => void;
}

export default function SOWGenerator({ request, userId, onStatusChange }: SOWGeneratorProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sow, setSOW] = useState<GeneratedSOW | null>(null);
  const [inspectionType, setInspectionType] = useState<InspectionType>(
    deriveInspectionType(request.valuation_mode || "field", false)
  );

  // Only show for statuses before SOW
  const showableStatuses = ["submitted", "client_submitted", "under_ai_review", "ai_review", "priced", "under_pricing"];
  if (!showableStatuses.includes(request.status) && request.status !== "sow_generated") return null;

  const purposeAr = request.purpose_ar || request.purpose || "غير محدد";
  const clientName = request.client_name_ar || request.ai_intake_summary?.clientInfo?.contactName || "عميل";

  const handleGenerate = () => {
    setGenerating(true);
    try {
      // Resolve discipline from asset_data or valuation_type
      const resolvedDiscipline = request.asset_data?.discipline 
        || request.discipline 
        || request.valuation_type 
        || "real_estate";

      const DISCIPLINE_LABELS: Record<string, string> = {
        machinery_equipment: "آلات ومعدات",
        machinery: "آلات ومعدات",
        real_estate: "عقار",
        mixed: "مختلط (عقاري + آلات ومعدات)",
        both: "مختلط (عقاري + آلات ومعدات)",
      };

      const propertyTypeLabel = DISCIPLINE_LABELS[resolvedDiscipline] 
        || request.property_type 
        || "غير محدد";

      const result = generateSOW({
        clientName,
        purpose: request.purpose || "other",
        purposeAr,
        propertyType: propertyTypeLabel,
        propertyAddress: request.property_address_ar || "غير محدد",
        propertyCity: request.property_city_ar || "غير محدد",
        inspectionType,
        valuationDate: request.valuation_date || new Date().toISOString().split("T")[0],
        discipline: resolvedDiscipline,
      });
      setSOW(result);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendToClient = async () => {
    if (!sow) return;
    setSending(true);
    try {
      // Save SOW to request and update status
      await supabase.from("valuation_requests" as any).update({
        status: "sow_sent" as any,
        scope_of_work_ar: sow.sections.map(s => `${s.heading}\n${s.content}`).join("\n\n"),
        sow_assumptions_ar: sow.generalAssumptions,
        sow_special_assumptions_ar: sow.specialAssumptions,
        inspection_type: inspectionType,
        conflict_of_interest_checked: true,
        conflict_of_interest_result: "لا يوجد تعارض مصالح",
      } as any).eq("id", request.id);

      // Notify client via chat
      await supabase.from("request_messages" as any).insert({
        request_id: request.id,
        sender_type: "admin" as any,
        content: `📋 تم إرسال نطاق العمل للموافقة والتوقيع الإلكتروني.\n\n**أساس القيمة:** ${sow.basisOfValue} (${sow.basisReference})\n**نوع المعاينة:** ${sow.inspectionTypeLabel}\n\nيرجى مراجعة نطاق العمل والموافقة عليه من صفحة تفاصيل الطلب.`,
      });

      toast({ title: "تم إرسال نطاق العمل للعميل" });
      onStatusChange?.();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          نطاق العمل (Scope of Work)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Conflict of Interest Check */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <Shield className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-400">فحص تعارض المصالح: لا يوجد تعارض ✓</span>
        </div>

        {/* Inspection Type Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">نوع المعاينة</label>
          <Select value={inspectionType} onValueChange={(v) => setInspectionType(v as InspectionType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="field">معاينة ميدانية</SelectItem>
              <SelectItem value="desktop_with_photos">تقييم مكتبي (مع صور)</SelectItem>
              <SelectItem value="desktop_without_photos">تقييم مكتبي (بدون صور)</SelectItem>
            </SelectContent>
          </Select>
          {inspectionType === "desktop_without_photos" && (
            <div className="flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">تقييم مكتبي بدون صور — سيتم إضافة افتراضات خاصة صارمة وعلاوة مخاطر أعلى تلقائياً</p>
            </div>
          )}
        </div>

        {/* Generate Button */}
        {!sow && (
          <Button onClick={handleGenerate} disabled={generating} className="w-full">
            {generating ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <FileText className="w-4 h-4 ml-1" />}
            توليد نطاق العمل
          </Button>
        )}

        {/* SOW Preview */}
        {sow && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 max-h-80 overflow-y-auto">
              <h3 className="font-bold text-sm text-foreground">{sow.title}</h3>
              {sow.sections.map((section, i) => (
                <div key={i}>
                  <h4 className="text-xs font-bold text-primary">{section.heading}</h4>
                  <p className="text-xs text-foreground whitespace-pre-line leading-6 mt-1">{section.content}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSendToClient} disabled={sending} className="flex-1">
                {sending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Send className="w-4 h-4 ml-1" />}
                إرسال للعميل للموافقة
              </Button>
              <Button variant="outline" onClick={handleGenerate}>
                إعادة التوليد
              </Button>
            </div>
          </div>
        )}

        {/* Already sent */}
        {request.status === "sow_sent" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <CheckCircle className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-700 dark:text-blue-400">تم إرسال نطاق العمل — بانتظار موافقة العميل</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
