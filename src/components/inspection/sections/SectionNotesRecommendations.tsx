import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  MapPin, Camera, ClipboardCheck, Send, ChevronRight, ChevronLeft, ChevronDown,
  Loader2, CheckCircle, AlertTriangle, Navigation, Trash2,
  Info, Building2, Ruler, Wrench, Zap, TrendingUp, ShieldAlert,
  FileCheck, UserCheck, Home, Upload, LayoutGrid, Copy, Lock,
} from "lucide-react";
import RaqeemIcon from "@/components/ui/RaqeemIcon";
import SectionPhotoUpload, { type SectionPhoto } from "@/components/inspection/SectionPhotoUpload";
import AiSuggestionBox from "@/components/inspection/AiSuggestionBox";
import { Label } from "@/components/ui/label";
import { SectionHeader, FieldGroup, ExpandableSection } from "./helpers";
import type { FormData, PhotoItem, ChecklistItem } from "./types";
import { toast } from "sonner";

export default function SectionNotesRecommendations({ formData, updateField, submitting, onSubmit }: any) {
  const [techSummary, setTechSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateTechSummary = () => {
    setSummaryLoading(true);
    setTechSummary(null);

    // Build structured summary from all form data
    setTimeout(() => {
      const lines: string[] = [];

      lines.push("══════ ملخص المعاينة الفنية ══════");
      lines.push(`📅 تاريخ المعاينة: ${formData.inspection_date || "—"}`);
      lines.push(`👤 المعاين: ${formData.inspector_name || "—"}`);
      lines.push(`📍 الموقع: ${[formData.city, formData.district, formData.street].filter(Boolean).join("، ") || "—"}`);
      lines.push(`🏠 نوع الأصل: ${formData.asset_type || "—"}`);
      lines.push(`📄 رقم الصك: ${formData.deed_number || "—"}`);
      lines.push("");

      // Areas
      const landArea = formData.land_area ? `${formData.land_area} م²` : "—";
      const buildingArea = formData.total_building_area ? `${formData.total_building_area} م²` : "—";
      lines.push("▬▬ المساحات ▬▬");
      lines.push(`مساحة الأرض: ${landArea} | مساحة البناء: ${buildingArea}`);
      if (formData.land_area && formData.total_building_area && parseFloat(formData.land_area) > 0) {
        const ratio = ((parseFloat(formData.total_building_area) / parseFloat(formData.land_area)) * 100).toFixed(1);
        lines.push(`نسبة البناء: ${ratio}%`);
      }
      if (formData.area_matches_license) lines.push(`تطابق المساحة مع الرخصة: ${formData.area_matches_license === "yes" ? "✅ نعم" : "❌ لا"}`);
      lines.push("");

      // Condition
      const conditionLabels: Record<string, string> = { excellent: "ممتازة", good: "جيدة", fair: "متوسطة", poor: "سيئة" };
      lines.push("▬▬ حالة الأصل ▬▬");
      lines.push(`الحالة العامة: ${conditionLabels[formData.overall_condition] || formData.overall_condition || "—"}`);
      if (formData.asset_age) lines.push(`عمر المبنى: ${formData.asset_age} سنة`);
      if (formData.finishing_level) lines.push(`مستوى التشطيب: ${formData.finishing_level}`);
      if (formData.maintenance_rating) lines.push(`مستوى الصيانة: ${formData.maintenance_rating}`);
      lines.push("");

      // Value factors
      const impactLabels: Record<string, string> = { weak: "ضعيف", medium: "متوسط", strong: "قوي" };
      const posLabels: Record<string, string> = { view: "إطلالة مميزة", prime_location: "موقع مميز", luxury_finish: "تشطيب راقي", modern: "حديث البناء" };
      const negLabels: Record<string, string> = { noise: "قرب ضوضاء", legal_issues: "إشكاليات قانونية", harmful_neighbor: "مجاور ضار" };

      const posEntries = Object.entries(formData.positive_factors || {});
      const negEntries = Object.entries(formData.negative_factors || {});

      if (posEntries.length > 0 || negEntries.length > 0) {
        lines.push("▬▬ العوامل المؤثرة على القيمة ▬▬");
        if (posEntries.length > 0) {
          lines.push("إيجابية:");
          posEntries.forEach(([k, v]) => lines.push(`  • ${posLabels[k] || k} — تأثير ${impactLabels[v as string] || v}`));
        }
        if (negEntries.length > 0) {
          lines.push("سلبية:");
          negEntries.forEach(([k, v]) => lines.push(`  • ${negLabels[k] || k} — تأثير ${impactLabels[v as string] || v}`));
        }
        if (formData.positive_factors_other) lines.push(`  • أخرى: ${formData.positive_factors_other}`);
        if (formData.negative_factors_other) lines.push(`  • أخرى: ${formData.negative_factors_other}`);
        lines.push("");
      }

      // Risks
      if (formData.has_risks === "yes") {
        lines.push("▬▬ المخاطر ▬▬");
        lines.push(`⚠️ ${formData.risk_details || "توجد مخاطر مسجلة"}`);
        lines.push("");
      }

      // Inspector notes & verdict
      if (formData.inspector_observations) {
        lines.push("▬▬ ملاحظات المعاين ▬▬");
        lines.push(formData.inspector_observations);
        lines.push("");
      }
      if (formData.inspector_recommendations) {
        lines.push("▬▬ التوصيات ▬▬");
        lines.push(formData.inspector_recommendations);
        lines.push("");
      }

      const verdictLabels: Record<string, string> = { complete: "✅ ملف مكتمل وجاهز للتقييم", needs_revisit: "🔄 يحتاج زيارة إضافية", has_issues: "⚠️ توجد إشكاليات" };
      if (formData.inspector_verdict) {
        lines.push("▬▬ التوصية النهائية ▬▬");
        lines.push(verdictLabels[formData.inspector_verdict] || formData.inspector_verdict);
        if (formData.inspector_verdict_notes) lines.push(formData.inspector_verdict_notes);
      }

      lines.push("");
      lines.push(`═══ نهاية الملخص — ${formatDate(new Date())} ═══`);

      setTechSummary(lines.join("\n"));
      setSummaryLoading(false);
    }, 800);
  };

  const handleCopySummary = () => {
    if (techSummary) {
      navigator.clipboard.writeText(techSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("✅ تم نسخ الملخص — يمكنك لصقه في التقرير");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={11} title="الملاحظات والتوصيات" icon={ClipboardCheck} subtitle="ملاحظات المعاين وتوصياته للمقيّم" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="📝 ملاحظات المعاين">
          <Textarea
            value={formData.inspector_observations}
            onChange={(e: any) => updateField("inspector_observations", e.target.value)}
            placeholder="ملاحظات عامة حول العقار، حالته، ومحيطه..."
            rows={4}
          />
        </FieldGroup>
        <FieldGroup label="💡 توصيات للمقيّم">
          <Textarea
            value={formData.inspector_recommendations}
            onChange={(e: any) => updateField("inspector_recommendations", e.target.value)}
            placeholder="توصيات مهنية بناءً على المعاينة (مثل: يُنصح بإجراء فحص إنشائي، التحقق من رخصة البناء...)..."
            rows={4}
          />
        </FieldGroup>
        <FieldGroup label="📎 ملاحظات إضافية">
          <Textarea
            value={formData.additional_notes}
            onChange={(e: any) => updateField("additional_notes", e.target.value)}
            placeholder="أي معلومات إضافية لم تُغطَّ في الأقسام السابقة..."
            rows={3}
          />
        </FieldGroup>

        <Separator />

        {/* Confidential section */}
        <div className="rounded-lg border-2 border-muted bg-muted/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="w-5 h-5" />
            <span className="text-sm font-bold">🔒 ملاحظات سرية — للمقيّم فقط</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            هذه الملاحظات لا تُضاف للتقرير النهائي ولا تُعرض للعميل. مخصصة فقط للمقيّم المسؤول.
          </p>
          <Textarea
            value={formData.confidential_notes}
            onChange={(e: any) => updateField("confidential_notes", e.target.value)}
            placeholder="ملاحظات سرية: شكوك حول صحة المستندات، مخاوف من تضخم القيمة، ملاحظات حول سلوك المالك، معلومات حساسة..."
            rows={4}
            className="border-muted bg-background"
          />
        </div>

        <Separator />

        <FieldGroup label="📋 توصية المعاين النهائية" required>
          <RadioGroup value={formData.inspector_verdict} onValueChange={(v: string) => updateField("inspector_verdict", v)} className="space-y-2">
            {[
              { value: "complete", label: "✅ ملف مكتمل", desc: "جميع البيانات والصور مكتملة وجاهزة للتقييم", style: "border-green-500 bg-green-50 dark:bg-green-900/20" },
              { value: "needs_revisit", label: "🔄 يحتاج زيارة إضافية", desc: "بعض العناصر تحتاج معاينة تكميلية", style: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" },
              { value: "has_issues", label: "⚠️ توجد إشكاليات", desc: "إشكاليات تمنع أو تؤثر على إتمام التقييم", style: "border-destructive bg-destructive/5" },
            ].map((opt) => (
              <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${formData.inspector_verdict === opt.value ? opt.style + " font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="mt-0.5" />
                <div>
                  <div className="text-sm">{opt.label}</div>
                  <div className="text-[11px] text-muted-foreground">{opt.desc}</div>
                </div>
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        {(formData.inspector_verdict === "needs_revisit" || formData.inspector_verdict === "has_issues") && (
          <FieldGroup label={formData.inspector_verdict === "needs_revisit" ? "🔄 سبب الزيارة الإضافية" : "⚠️ تفاصيل الإشكاليات"} required>
            <Textarea
              value={formData.inspector_verdict_notes}
              onChange={(e: any) => updateField("inspector_verdict_notes", e.target.value)}
              placeholder={formData.inspector_verdict === "needs_revisit" ? "ما العناصر التي تحتاج معاينة إضافية؟..." : "ما الإشكاليات المكتشفة وتأثيرها؟..."}
              rows={3}
              className={formData.inspector_verdict === "has_issues" ? "border-destructive/30" : "border-yellow-300"}
            />
          </FieldGroup>
        )}

        <AiSuggestionBox
          sectionKey="notes_recommendations"
          promptHint="اقتراح ملاحظات وتوصيات بناءً على بيانات المعاينة"
          context={{
            inspector_observations: formData.inspector_observations,
            inspector_recommendations: formData.inspector_recommendations,
            inspector_verdict: formData.inspector_verdict,
            overall_condition: formData.overall_condition,
            has_risks: formData.has_risks,
          }}
        />

        <Separator />

        {/* Technical Summary Generator */}
        <div className="rounded-lg border-2 border-ai/30 bg-ai-light p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-ai">
              <RaqeemIcon size={20} />
              <span className="text-sm font-bold">✨ ملخص فني جاهز للتقرير</span>
            </div>
            <Button
              size="sm"
              onClick={generateTechSummary}
              disabled={summaryLoading}
              className="h-8 text-xs gap-1.5 bg-ai text-ai-foreground hover:bg-ai/90"
            >
              {summaryLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RaqeemIcon size={14} />}
              {summaryLoading ? "جاري التوليد..." : "✨ توليد الملخص"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            يُولّد ملخصاً تقنياً مهنياً شاملاً من جميع بيانات المعاينة — جاهز للنسخ واللصق في التقرير
          </p>

          {techSummary && (
            <div className="relative group">
              <pre className="bg-card border rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap font-sans text-foreground max-h-[400px] overflow-y-auto">
                {techSummary}
              </pre>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleCopySummary}>
                  {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "تم النسخ" : "نسخ الملخص"}
                </Button>
              </div>

              {/* Submit after reviewing summary */}
              <Separator className="my-3" />
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3 text-center">
                <p className="text-sm font-semibold text-primary">✅ راجعت الملخص وأرغب بإرسال المعاينة</p>
                <p className="text-[11px] text-muted-foreground">
                  بالضغط على "إرسال المعاينة" تؤكد أن جميع البيانات دقيقة وتعكس الواقع الفعلي
                </p>
                <Button
                  className="w-full h-12 text-base gap-2"
                  disabled={submitting}
                  onClick={async () => {
                    const approvalName = formData.approval_inspector_name || formData.inspector_name;
                    if (!approvalName) {
                      toast.error("يرجى إدخال اسم المعاين في قسم الاعتماد أولاً");
                      return;
                    }
                    updateField("approval_inspector_name", approvalName);
                    updateField("approval_date", new Date().toISOString().split("T")[0]);
                    await onSubmit();
                  }}
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  إرسال المعاينة
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

