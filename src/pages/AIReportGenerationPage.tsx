import { useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Sparkles, FileText, Wand2, CheckCircle2, Loader2, Copy, RefreshCw,
  Edit3, ChevronDown, ChevronUp, AlertCircle, Database, Layers,
  FileCheck, Download, Eye, ArrowLeft, ArrowRight, Search, Link2,
  Building2, User, MapPin, ClipboardCheck, BarChart3, Scale, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ──────────────────── Types ──────────────────── */
type PipelineStep = 0 | 1 | 2 | 3 | 4 | 5;

interface ReportDraft {
  report_title_ar?: string;
  report_title_en?: string;
  reference_number?: string;
  report_date?: string;
  sections?: Record<string, {
    title_ar?: string;
    title_en?: string;
    content_ar?: string;
    content_en?: string;
    tables?: { caption_ar?: string; headers?: string[]; rows?: string[][] }[];
  }>;
  final_value?: {
    amount?: number;
    currency?: string;
    text_ar?: string;
    text_en?: string;
    effective_date?: string;
    basis_of_value_ar?: string;
    confidence_level?: string;
  };
  metadata?: {
    standards_referenced?: string[];
    approaches_used?: string[];
    data_completeness_pct?: number;
    sections_needing_review?: string[];
    missing_data_items?: string[];
  };
}

interface AggregatedData {
  request?: any;
  client?: any;
  assignment?: any;
  subject?: any;
  inspection?: any;
  inspection_analysis?: any;
  inspection_photos?: any[];
  inspection_checklist?: any[];
  comparables?: any[];
  document_extractions?: any[];
  assumptions?: any[];
  reconciliation?: any;
  compliance_checks?: any[];
  portfolio_assets?: any[];
  valuer?: any;
  reviewer?: any;
  organization?: any;
}

const PIPELINE_STEPS = [
  { key: "data", label: "جمع البيانات", icon: Database, desc: "ربط الطلب وجمع جميع البيانات" },
  { key: "generate", label: "توليد المسودة", icon: Wand2, desc: "توليد أقسام التقرير بالذكاء الاصطناعي" },
  { key: "sections", label: "مراجعة الأقسام", icon: Layers, desc: "مراجعة وتعديل كل قسم" },
  { key: "review", label: "فحص الجودة", icon: Eye, desc: "مراجعة شاملة وتحسينات" },
  { key: "preview", label: "المعاينة", icon: FileCheck, desc: "معاينة التقرير النهائي" },
  { key: "export", label: "التصدير", icon: Download, desc: "إنشاء مسودة التقرير" },
];

const DATA_CATEGORIES = [
  { key: "request", label: "بيانات الطلب", icon: FileText },
  { key: "client", label: "بيانات العميل", icon: User },
  { key: "subject", label: "وصف العقار", icon: Building2 },
  { key: "inspection", label: "المعاينة الميدانية", icon: ClipboardCheck },
  { key: "comparables", label: "المقارنات السوقية", icon: BarChart3 },
  { key: "reconciliation", label: "التسوية والقيمة", icon: Scale },
];

/* ──────────────────── Streaming helper for review ──────────────────── */
async function streamReportContent(
  params: { mode: string; existingText?: string; context: Record<string, any> },
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void
) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report-content`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "خطأ غير معروف" }));
    onError(err.error || "خطأ في التوليد");
    return;
  }

  if (!resp.body) { onError("لا يوجد استجابة"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const c = parsed.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
  onDone();
}

/* ──────────────────── Main Component ──────────────────── */
export default function AIReportGenerationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRequestId = searchParams.get("request_id") || "";

  const [step, setStep] = useState<PipelineStep>(0);
  const [requestId, setRequestId] = useState(initialRequestId);
  const [stepErrors, setStepErrors] = useState<Record<number, string | null>>({});

  // Data collection state
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState("");

  // Review state
  const [reviewOutput, setReviewOutput] = useState("");
  const reviewRef = useRef("");
  const [isReviewing, setIsReviewing] = useState(false);

  // Helper to determine step status
  const getStepStatus = (idx: number): "idle" | "loading" | "done" | "error" => {
    if (stepErrors[idx]) return "error";
    if (idx < step) return "done";
    if (idx === step) {
      if (idx === 0 && isLoadingData) return "loading";
      if (idx === 1 && isGenerating) return "loading";
      if (idx === 3 && isReviewing) return "loading";
      return "idle";
    }
    return "idle";
  };

  /* ─── Step 0: Collect Data ─── */
  const handleCollectData = useCallback(async () => {
    if (!requestId.trim()) {
      toast.error("يرجى إدخال معرّف الطلب");
      return;
    }
    setIsLoadingData(true);
    setDataError(null);
    setStepErrors(prev => ({ ...prev, 0: null }));

    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { request_id: requestId.trim(), mode: "collect_data" },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setAggregatedData(data);
      toast.success("تم جمع جميع البيانات المرتبطة بالطلب");
    } catch (err: any) {
      const msg = err.message || "خطأ في جمع البيانات";
      setDataError(msg);
      setStepErrors(prev => ({ ...prev, 0: msg }));
      toast.error(msg);
    } finally {
      setIsLoadingData(false);
    }
  }, [requestId]);

  /* ─── Step 1: Generate Draft ─── */
  const handleGenerateDraft = useCallback(async () => {
    setIsGenerating(true);
    setStep(1);
    setStepErrors(prev => ({ ...prev, 1: null }));

    try {
      const { data, error } = await supabase.functions.invoke("generate-report", {
        body: { request_id: requestId.trim(), mode: "generate_draft" },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.success && data.report_draft) {
        setReportDraft(data.report_draft);
        setStep(2);
        toast.success("تم توليد مسودة التقرير بنجاح");
      } else if (data?.raw_content) {
        toast.warning("تم التوليد لكن لم يتم تحليل الاستجابة كـ JSON");
        setStep(2);
      } else {
        throw new Error("لم يتم توليد التقرير");
      }
    } catch (err: any) {
      const msg = err.message || "خطأ في توليد التقرير";
      setStepErrors(prev => ({ ...prev, 1: msg }));
      setStep(0);
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  }, [requestId]);

  /* ─── Handlers ─── */
  const handleSaveEdit = (sectionKey: string) => {
    if (reportDraft?.sections?.[sectionKey]) {
      setReportDraft({
        ...reportDraft,
        sections: {
          ...reportDraft.sections,
          [sectionKey]: {
            ...reportDraft.sections[sectionKey],
            content_ar: editBuffer,
          },
        },
      });
    }
    setEditingSection(null);
    setEditBuffer("");
    toast.success("تم حفظ التعديل");
  };

  const handleReviewAll = useCallback(() => {
    if (!reportDraft?.sections) return;
    setIsReviewing(true);
    setReviewOutput("");
    reviewRef.current = "";
    setStep(3);

    const allText = Object.entries(reportDraft.sections)
      .map(([key, sec]) => `## ${sec.title_ar || key}\n${sec.content_ar || ""}`)
      .join("\n\n");

    const context = {
      assetType: aggregatedData?.request?.property_type || "عقاري",
      assetDescription: aggregatedData?.request?.property_description_ar || "",
      assetCity: aggregatedData?.request?.property_city_ar || "",
    };

    streamReportContent(
      { mode: "review", existingText: allText, context },
      (delta) => { reviewRef.current += delta; setReviewOutput(reviewRef.current); },
      () => { setIsReviewing(false); toast.success("تم فحص الجودة"); },
      (err) => { setIsReviewing(false); toast.error(err); }
    );
  }, [reportDraft, aggregatedData]);

  const handleCreateDraft = () => {
    toast.success("تم إنشاء مسودة التقرير بنجاح");
    navigate("/reports/generate");
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  const sectionEntries = reportDraft?.sections ? Object.entries(reportDraft.sections) : [];
  const sectionCount = sectionEntries.length;

  // Data completeness indicators
  const dataChecks = aggregatedData ? [
    { label: "بيانات الطلب", ok: !!aggregatedData.request?.id },
    { label: "بيانات العميل", ok: !!aggregatedData.client?.profile || !!aggregatedData.client?.record },
    { label: "المهمة", ok: !!aggregatedData.assignment?.id },
    { label: "وصف العقار", ok: !!aggregatedData.subject },
    { label: "المعاينة", ok: !!aggregatedData.inspection?.id },
    { label: "تحليل المعاينة", ok: !!aggregatedData.inspection_analysis },
    { label: "المقارنات", ok: (aggregatedData.comparables?.length || 0) > 0 },
    { label: "المستندات", ok: (aggregatedData.document_extractions?.length || 0) > 0 },
    { label: "التسوية", ok: !!aggregatedData.reconciliation },
    { label: "المنشأة", ok: !!aggregatedData.organization },
  ] : [];

  const completeness = dataChecks.length > 0
    ? Math.round((dataChecks.filter(d => d.ok).length / dataChecks.length) * 100)
    : 0;

  return (
    <div className="space-y-6" dir="rtl">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">نظام توليد التقارير الآلي</h1>
            <p className="text-sm text-muted-foreground">رقيم يُنشئ مسودة تقرير تقييم كاملة وفق IVS 2025 ومعايير تقييم</p>
          </div>
        </div>
        {aggregatedData?.assignment?.reference_number && (
          <Badge variant="outline" className="gap-1 text-xs">
            <FileText className="w-3 h-3" />
            {aggregatedData.assignment.reference_number}
          </Badge>
        )}
      </div>

      {/* ─── Pipeline Stepper ─── */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between">
            {PIPELINE_STEPS.map((ps, idx) => {
              const done = idx < step;
              const active = idx === step;
              const Icon = ps.icon;
              return (
                <div key={ps.key} className="flex items-center flex-1 last:flex-none">
                  <div
                    className="flex flex-col items-center gap-1 cursor-pointer"
                    onClick={() => { if (done) setStep(idx as PipelineStep); }}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      done ? "bg-primary border-primary text-primary-foreground"
                        : active ? "border-primary text-primary bg-primary/10 shadow-md shadow-primary/20"
                        : "border-muted-foreground/20 text-muted-foreground/40 bg-muted/20"
                    }`}>
                      {done ? <CheckCircle2 className="w-4.5 h-4.5" />
                        : (active && (isGenerating || isLoadingData)) ? <Loader2 className="w-4.5 h-4.5 animate-spin" />
                        : <Icon className="w-4.5 h-4.5" />}
                    </div>
                    <span className={`text-[10px] font-medium whitespace-nowrap ${done ? "text-primary" : active ? "text-primary font-bold" : "text-muted-foreground/40"}`}>
                      {ps.label}
                    </span>
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <div className="flex-1 mx-1.5">
                      <div className={`h-0.5 rounded-full transition-all ${idx < step ? "bg-primary" : "bg-muted-foreground/15"}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════ */}
      {/* Step 0: Data Collection via request_id     */}
      {/* ═══════════════════════════════════════════ */}
      {step === 0 && (
        <div className="space-y-4">
          {/* Request ID Input */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                ربط الطلب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">معرّف الطلب (Request ID)</Label>
                  <Input
                    value={requestId}
                    onChange={(e) => setRequestId(e.target.value)}
                    placeholder="أدخل معرّف الطلب (UUID)..."
                    className="text-sm font-mono"
                    dir="ltr"
                  />
                </div>
                <Button
                  onClick={handleCollectData}
                  disabled={isLoadingData || !requestId.trim()}
                  className="gap-2"
                >
                  {isLoadingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  جمع البيانات
                </Button>
              </div>

              {dataError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {dataError}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aggregated Data Summary */}
          {aggregatedData && (
            <>
              {/* Completeness bar */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">اكتمال البيانات</span>
                    <Badge variant={completeness >= 80 ? "default" : completeness >= 50 ? "secondary" : "destructive"} className="text-xs">
                      {completeness}%
                    </Badge>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${completeness >= 80 ? "bg-primary" : completeness >= 50 ? "bg-yellow-500" : "bg-destructive"}`}
                      style={{ width: `${completeness}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {dataChecks.map((check) => (
                      <Badge key={check.label} variant={check.ok ? "default" : "outline"} className={`text-[10px] gap-1 ${check.ok ? "" : "text-muted-foreground"}`}>
                        {check.ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {check.label}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Data Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Request Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      بيانات الطلب
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1">
                    <InfoRow label="النوع" value={aggregatedData.request?.property_type} />
                    <InfoRow label="الغرض" value={aggregatedData.request?.purpose} />
                    <InfoRow label="أساس القيمة" value={aggregatedData.request?.basis_of_value} />
                    <InfoRow label="الحالة" value={aggregatedData.request?.status} />
                    <InfoRow label="مساحة الأرض" value={aggregatedData.request?.land_area ? `${aggregatedData.request.land_area} م²` : null} />
                    <InfoRow label="مساحة البناء" value={aggregatedData.request?.building_area ? `${aggregatedData.request.building_area} م²` : null} />
                  </CardContent>
                </Card>

                {/* Client Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      بيانات العميل
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1">
                    <InfoRow label="الاسم" value={aggregatedData.client?.record?.name_ar || aggregatedData.client?.profile?.full_name_ar} />
                    <InfoRow label="النوع" value={aggregatedData.client?.record?.client_type} />
                    <InfoRow label="الهوية" value={aggregatedData.client?.record?.id_number} />
                    <InfoRow label="الهاتف" value={aggregatedData.client?.record?.phone || aggregatedData.client?.profile?.phone} />
                    <InfoRow label="البريد" value={aggregatedData.client?.record?.email || aggregatedData.client?.profile?.email} />
                  </CardContent>
                </Card>

                {/* Property Subject */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      العقار
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1">
                    {aggregatedData.subject ? (
                      <>
                        <InfoRow label="الصك" value={aggregatedData.subject.title_deed_number} />
                        <InfoRow label="المدينة" value={aggregatedData.subject.city_ar} />
                        <InfoRow label="الحي" value={aggregatedData.subject.district_ar} />
                        <InfoRow label="المساحة" value={aggregatedData.subject.land_area ? `${aggregatedData.subject.land_area} م²` : null} />
                        <InfoRow label="الاستخدام" value={aggregatedData.subject.current_use_ar} />
                        <InfoRow label="الحالة" value={aggregatedData.subject.building_condition} />
                      </>
                    ) : (
                      <p className="text-muted-foreground">لا توجد بيانات عقار مسجّلة</p>
                    )}
                  </CardContent>
                </Card>

                {/* Inspection */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-primary" />
                      المعاينة الميدانية
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1">
                    {aggregatedData.inspection ? (
                      <>
                        <InfoRow label="التاريخ" value={aggregatedData.inspection.inspection_date} />
                        <InfoRow label="الحالة" value={aggregatedData.inspection.status} />
                        <InfoRow label="GPS" value={aggregatedData.inspection.gps_verified ? "✓ تم التحقق" : "✗"} />
                        {aggregatedData.inspection_analysis && (
                          <>
                            <InfoRow label="تقييم الحالة" value={aggregatedData.inspection_analysis.condition_rating} />
                            <InfoRow label="درجة الجودة" value={aggregatedData.inspection_analysis.quality_score?.toString()} />
                            <InfoRow label="الإهلاك المادي" value={aggregatedData.inspection_analysis.physical_depreciation_pct ? `${aggregatedData.inspection_analysis.physical_depreciation_pct}%` : null} />
                          </>
                        )}
                        <InfoRow label="الصور" value={`${aggregatedData.inspection_photos?.length || 0} صورة`} />
                      </>
                    ) : (
                      <p className="text-muted-foreground">لم تتم المعاينة بعد</p>
                    )}
                  </CardContent>
                </Card>

                {/* Comparables */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      المقارنات ({aggregatedData.comparables?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1.5">
                    {aggregatedData.comparables?.length ? (
                      aggregatedData.comparables.slice(0, 4).map((comp: any, i: number) => (
                        <div key={i} className="flex justify-between p-1.5 rounded bg-muted/40">
                          <span>{comp.comparable?.district_ar || comp.comparable?.city_ar || `مقارنة ${i + 1}`}</span>
                          <span className="font-mono text-primary">
                            {comp.comparable?.price ? `${Number(comp.comparable.price).toLocaleString()} ر.س` : "—"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">لا توجد مقارنات مسجّلة</p>
                    )}
                  </CardContent>
                </Card>

                {/* Reconciliation & Organization */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Scale className="w-4 h-4 text-primary" />
                      التسوية والمنشأة
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1">
                    {aggregatedData.reconciliation ? (
                      <>
                        <InfoRow label="القيمة النهائية" value={`${Number(aggregatedData.reconciliation.final_value).toLocaleString()} ر.س`} />
                        <InfoRow label="مستوى الثقة" value={aggregatedData.reconciliation.confidence_level} />
                      </>
                    ) : (
                      <InfoRow label="التسوية" value="لم تتم بعد" />
                    )}
                    <Separator className="my-1.5" />
                    <InfoRow label="المنشأة" value={aggregatedData.organization?.name_ar} />
                    <InfoRow label="المقيّم" value={aggregatedData.valuer?.full_name_ar} />
                    <InfoRow label="المراجع" value={aggregatedData.reviewer?.full_name_ar} />
                  </CardContent>
                </Card>
              </div>

              {/* Generate Button */}
              <div className="flex justify-center pt-2">
                <Button size="lg" className="gap-2 min-w-[280px]" onClick={handleGenerateDraft}>
                  <Wand2 className="w-5 h-5" />
                  توليد مسودة التقرير الكاملة
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Step 1: Generating                         */}
      {/* ═══════════════════════════════════════════ */}
      {step === 1 && (
        <Card className="border-primary/20">
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-foreground">جارٍ توليد التقرير...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                رقيم يحلل جميع البيانات ويكتب 20+ قسماً وفقاً لمعايير IVS 2025 وتقييم
              </p>
              <p className="text-xs text-muted-foreground mt-2">قد يستغرق هذا 30-60 ثانية</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Step 2: Section Review                     */}
      {/* ═══════════════════════════════════════════ */}
      {step === 2 && reportDraft && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              أقسام التقرير المُولّدة
              <Badge variant="secondary" className="text-[10px]">{sectionCount} قسم</Badge>
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(0)} className="gap-1">
                <ArrowRight className="w-3 h-3" /> رجوع
              </Button>
              <Button size="sm" onClick={handleReviewAll} className="gap-1">
                فحص الجودة <ArrowLeft className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Metadata summary */}
          {reportDraft.metadata && (
            <Card className="bg-muted/30">
              <CardContent className="py-3">
                <div className="flex flex-wrap gap-4 text-xs">
                  {reportDraft.metadata.data_completeness_pct != null && (
                    <span>اكتمال البيانات: <strong>{reportDraft.metadata.data_completeness_pct}%</strong></span>
                  )}
                  {reportDraft.metadata.approaches_used?.length ? (
                    <span>الأساليب: <strong>{reportDraft.metadata.approaches_used.join("، ")}</strong></span>
                  ) : null}
                  {reportDraft.metadata.standards_referenced?.length ? (
                    <span>المعايير: <strong>{reportDraft.metadata.standards_referenced.join("، ")}</strong></span>
                  ) : null}
                </div>
                {reportDraft.metadata.missing_data_items?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {reportDraft.metadata.missing_data_items.map((item, i) => (
                      <Badge key={i} variant="destructive" className="text-[9px]">{item}</Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Final Value Card */}
          {reportDraft.final_value && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">القيمة النهائية المستنتجة</p>
                    <p className="text-2xl font-bold text-primary mt-1">
                      {reportDraft.final_value.amount?.toLocaleString()} {reportDraft.final_value.currency || "ر.س"}
                    </p>
                    {reportDraft.final_value.text_ar && (
                      <p className="text-xs text-muted-foreground mt-1">{reportDraft.final_value.text_ar}</p>
                    )}
                  </div>
                  <div className="text-left text-xs space-y-1">
                    {reportDraft.final_value.basis_of_value_ar && (
                      <p>أساس القيمة: <strong>{reportDraft.final_value.basis_of_value_ar}</strong></p>
                    )}
                    {reportDraft.final_value.confidence_level && (
                      <Badge variant={reportDraft.final_value.confidence_level === "high" ? "default" : "secondary"} className="text-[9px]">
                        ثقة: {reportDraft.final_value.confidence_level === "high" ? "عالية" : reportDraft.final_value.confidence_level === "medium" ? "متوسطة" : "منخفضة"}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sections List */}
          <div className="space-y-2">
            {sectionEntries.map(([key, sec]) => {
              const isExpanded = expandedSection === key;
              const isEditing = editingSection === key;

              return (
                <Card key={key} className="transition-all">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedSection(isExpanded ? null : key)}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{sec.title_ar || key}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {sec.content_ar && (
                        <Badge variant="secondary" className="text-[9px]">
                          {sec.content_ar.length} حرف
                        </Badge>
                      )}
                      {sec.tables?.length ? (
                        <Badge variant="outline" className="text-[9px]">{sec.tables.length} جدول</Badge>
                      ) : null}
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <CardContent className="pt-0 space-y-3">
                      <Separator />
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editBuffer}
                            onChange={(e) => setEditBuffer(e.target.value)}
                            rows={10}
                            className="text-sm"
                          />
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => setEditingSection(null)}>إلغاء</Button>
                            <Button size="sm" onClick={() => handleSaveEdit(key)}>حفظ</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="prose prose-sm dark:prose-invert max-w-none text-right bg-muted/20 rounded-lg p-3 max-h-[350px] overflow-y-auto">
                            <ReactMarkdown>{sec.content_ar || "لا يوجد محتوى"}</ReactMarkdown>
                          </div>

                          {/* Tables */}
                          {sec.tables?.map((tbl, tIdx) => (
                            <div key={tIdx} className="overflow-x-auto">
                              {tbl.caption_ar && <p className="text-xs font-bold mb-1">{tbl.caption_ar}</p>}
                              <table className="w-full text-xs border border-border rounded-lg">
                                <thead>
                                  <tr className="bg-muted/50">
                                    {tbl.headers?.map((h, hIdx) => (
                                      <th key={hIdx} className="p-2 text-right border-b border-border">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {tbl.rows?.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-muted/20">
                                      {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="p-2 border-b border-border/50">{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}

                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => handleCopy(sec.content_ar || "")}>
                              <Copy className="w-3 h-3" /> نسخ
                            </Button>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { setEditingSection(key); setEditBuffer(sec.content_ar || ""); }}>
                              <Edit3 className="w-3 h-3" /> تعديل
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Step 3: Quality Review                     */}
      {/* ═══════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> فحص الجودة والامتثال
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-1">
                <ArrowRight className="w-3 h-3" /> رجوع
              </Button>
              <Button size="sm" onClick={() => setStep(4)} className="gap-1" disabled={isReviewing}>
                التالي <ArrowLeft className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {!isReviewing && !reviewOutput && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center space-y-3">
                <Eye className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">رقيم سيراجع جميع الأقسام ويفحص الامتثال لمعايير IVS 2025</p>
                <Button className="gap-2" onClick={handleReviewAll}>
                  <Sparkles className="w-4 h-4" /> بدء فحص الجودة
                </Button>
              </CardContent>
            </Card>
          )}

          {(isReviewing || reviewOutput) && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> تقرير الجودة
                  {isReviewing && <Badge variant="secondary" className="gap-1 text-[10px]"><Loader2 className="w-3 h-3 animate-spin" /> جارٍ المراجعة</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none text-right bg-muted/20 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  <ReactMarkdown>{reviewOutput || "..."}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Step 4: Preview                            */}
      {/* ═══════════════════════════════════════════ */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" /> معاينة التقرير
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(3)} className="gap-1">
                <ArrowRight className="w-3 h-3" /> رجوع
              </Button>
              <Button size="sm" onClick={() => setStep(5)} className="gap-1">
                إنشاء المسودة <ArrowLeft className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* ─── Cover Page ─── */}
          <Card className="border-2 border-primary/20 overflow-hidden">
            <div className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 p-8 md:p-12">
              {/* Decorative corner accents */}
              <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-primary/30 rounded-tl-lg" />
              <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-primary/30 rounded-br-lg" />

              <div className="flex flex-col items-center text-center space-y-6 py-6">
                {/* Organization Logo/Name */}
                {aggregatedData?.organization?.name_ar && (
                  <div className="space-y-1">
                    <p className="text-sm tracking-widest text-muted-foreground font-medium uppercase">
                      {aggregatedData.organization.name_en || "Valuation Report"}
                    </p>
                    <h3 className="text-lg font-bold text-foreground">
                      {aggregatedData.organization.name_ar}
                    </h3>
                    {aggregatedData.organization.taqeem_registration && (
                      <p className="text-[10px] text-muted-foreground">
                        رقم التسجيل: {aggregatedData.organization.taqeem_registration}
                      </p>
                    )}
                  </div>
                )}

                <Separator className="w-1/3 mx-auto" />

                {/* Report Title */}
                <div className="space-y-2">
                  <p className="text-xs tracking-[0.3em] text-primary font-semibold uppercase">
                    تقرير تقييم عقاري
                  </p>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight">
                    {reportDraft?.report_title_ar || "تقرير تقييم القيمة السوقية"}
                  </h2>
                  {reportDraft?.report_title_en && (
                    <p className="text-sm text-muted-foreground" dir="ltr">
                      {reportDraft.report_title_en}
                    </p>
                  )}
                </div>

                <Separator className="w-1/3 mx-auto" />

                {/* Cover Page Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg text-right">
                  {/* Client Name */}
                  <div className="p-4 rounded-xl bg-background/80 border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <User className="w-4 h-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-medium">اسم العميل</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {aggregatedData?.client?.record?.name_ar
                        || aggregatedData?.client?.profile?.full_name_ar
                        || "—"}
                    </p>
                    {(aggregatedData?.client?.record?.id_number || aggregatedData?.client?.record?.cr_number) && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {aggregatedData.client.record.id_type || "هوية"}: {aggregatedData.client.record.id_number || aggregatedData.client.record.cr_number}
                      </p>
                    )}
                  </div>

                  {/* Property Type */}
                  <div className="p-4 rounded-xl bg-background/80 border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-medium">نوع العقار</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {aggregatedData?.request?.property_type || "—"}
                    </p>
                    {aggregatedData?.request?.property_city_ar && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {aggregatedData.request.property_city_ar}
                        {aggregatedData.request.property_district_ar ? ` — ${aggregatedData.request.property_district_ar}` : ""}
                      </p>
                    )}
                  </div>

                  {/* Report Number */}
                  <div className="p-4 rounded-xl bg-background/80 border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-medium">رقم التقرير</span>
                    </div>
                    <p className="text-sm font-bold text-foreground font-mono" dir="ltr">
                      {reportDraft?.reference_number
                        || aggregatedData?.assignment?.reference_number
                        || "—"}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="p-4 rounded-xl bg-background/80 border border-border/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-medium">تاريخ التقرير</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {reportDraft?.report_date
                        || new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* Standards Badge */}
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  <Badge variant="outline" className="text-[10px] gap-1">IVS 2025</Badge>
                  <Badge variant="outline" className="text-[10px] gap-1">معايير تقييم</Badge>
                  <Badge variant="outline" className="text-[10px] gap-1">سرّي وخاص</Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* ─── Sections Preview ─── */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <h3 className="text-sm font-bold text-foreground mb-2">فهرس أقسام التقرير</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {sectionEntries.map(([key, sec], idx) => (
                  <div key={key} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-primary">{sec.title_ar || key}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{sec.content_ar?.substring(0, 150)}...</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Step 5: Export                             */}
      {/* ═══════════════════════════════════════════ */}
      {step === 5 && (
        <Card className="border-primary/20">
          <CardContent className="py-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">التقرير جاهز للإنشاء</h3>
              <p className="text-sm text-muted-foreground mt-1">
                تم توليد ومراجعة جميع أقسام التقرير وفق معايير IVS 2025 ومعايير الهيئة السعودية للمقيمين المعتمدين
              </p>
            </div>

            <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto text-center">
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-2xl font-bold text-primary">{sectionCount}</p>
                <p className="text-[10px] text-muted-foreground">أقسام مُولّدة</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-2xl font-bold text-primary">{aggregatedData?.comparables?.length || 0}</p>
                <p className="text-[10px] text-muted-foreground">مقارنات</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-2xl font-bold text-primary">{completeness}%</p>
                <p className="text-[10px] text-muted-foreground">اكتمال</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-2xl font-bold text-primary">IVS</p>
                <p className="text-[10px] text-muted-foreground">2025</p>
              </div>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <Button variant="outline" className="gap-2" onClick={() => setStep(2)}>
                <Edit3 className="w-4 h-4" /> تعديل الأقسام
              </Button>
              <Button size="lg" className="gap-2" onClick={handleCreateDraft}>
                <FileText className="w-4 h-4" /> إنشاء مسودة التقرير
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Helper Component ─── */
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}
