import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  FileText,
  Wand2,
  CheckCircle2,
  Loader2,
  Copy,
  RefreshCw,
  Send,
  BookOpen,
  ClipboardList,
  Eye,
  ArrowLeft,
  ArrowRight,
  Database,
  Layers,
  FileCheck,
  Download,
  Edit3,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { REPORT_SECTIONS, type ReportData } from "@/lib/report-types";

/* ──────────────────── Types ──────────────────── */
type Mode = "full_report" | "section" | "review" | "structured_sections";
type PipelineStep = 0 | 1 | 2 | 3 | 4 | 5;

const PIPELINE_STEPS = [
  { key: "data", label: "جمع البيانات", icon: Database, desc: "بيانات العقار والعميل والمعاينة" },
  { key: "generate", label: "توليد المسودة", icon: Wand2, desc: "توليد أقسام التقرير بالذكاء الاصطناعي" },
  { key: "sections", label: "مراجعة الأقسام", icon: Layers, desc: "مراجعة وتعديل كل قسم" },
  { key: "review", label: "فحص الجودة", icon: Eye, desc: "مراجعة شاملة وتحسينات" },
  { key: "preview", label: "المعاينة", icon: FileCheck, desc: "معاينة التقرير النهائي" },
  { key: "export", label: "التصدير", icon: Download, desc: "إنشاء مسودة التقرير" },
];

const GENERABLE_SECTIONS = [
  { key: "purpose", label: "الغرض والاستخدام المقصود" },
  { key: "scope", label: "نطاق العمل" },
  { key: "property_desc", label: "وصف العقار" },
  { key: "legal", label: "الوصف القانوني والملكية" },
  { key: "market", label: "نظرة السوق" },
  { key: "hbu", label: "الاستخدام الأعلى والأفضل" },
  { key: "approaches", label: "أساليب التقييم" },
  { key: "calculations", label: "الحسابات والتحليل" },
  { key: "reconciliation", label: "التسوية والرأي النهائي" },
  { key: "assumptions", label: "الافتراضات والقيود" },
  { key: "compliance", label: "بيان الامتثال" },
];

/* ──────────────────── Streaming helper ──────────────────── */
async function streamReportContent(
  params: { mode: Mode; sectionKey?: string; existingText?: string; context: Record<string, any> },
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

async function generateStructuredSections(
  context: Record<string, any>,
  sectionKeys: string[]
): Promise<Record<string, string>> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report-content`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ mode: "structured_sections", sectionKeys, context }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "خطأ" }));
    throw new Error(err.error || "خطأ في التوليد");
  }

  const result = await resp.json();
  if (result.structured && result.data?.sections) {
    return result.data.sections;
  }
  throw new Error("لم يتم توليد البيانات المهيكلة");
}

/* ──────────────────── Main Component ──────────────────── */
export default function AIReportGenerationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<PipelineStep>(0);
  const [activeTab, setActiveTab] = useState<string>("full");

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamOutput, setStreamOutput] = useState("");
  const streamRef = useRef("");
  const [generatedSections, setGeneratedSections] = useState<Record<string, string>>({});
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState("");

  // Review state
  const [reviewOutput, setReviewOutput] = useState("");
  const reviewRef = useRef("");
  const [isReviewing, setIsReviewing] = useState(false);

  // Context (mock data pre-filled)
  const [ctx, setCtx] = useState({
    assetType: "real_estate",
    assetDescription: "فيلا سكنية مكونة من طابقين وملحق علوي بمساحة بناء 450 متر مربع",
    assetLocation: "حي النرجس، الرياض",
    assetCity: "الرياض",
    methodology: "market_comparison",
    estimatedValue: "3250000",
    clientName: "شركة الرحمانية للتطوير",
    clientIdNumber: "1010XXXXXX",
    purposeOfValuation: "تقدير القيمة السوقية للعقار لغرض البيع",
    landArea: "625",
    buildingArea: "450",
    propertyType: "سكني",
    ownershipType: "ملكية حرة كاملة",
    inspectionDate: "2026-03-20",
    valuationDate: "2026-03-25",
    referenceNumber: "VAL-2026-0042",
    inspectionSummary: "تمت المعاينة الداخلية والخارجية الكاملة. العقار بحالة جيدة جداً. تشطيبات فاخرة بدون عيوب إنشائية ظاهرة.",
  });

  const comparables = [
    { description: "فيلا سكنية مماثلة، حي النرجس، 600 م²", value: 2800000, source: "وزارة العدل" },
    { description: "فيلا سكنية، حي الياسمين، 650 م²", value: 3100000, source: "منصة عقار" },
    { description: "فيلا دوبلكس، حي النرجس، 580 م²", value: 2650000, source: "وزارة العدل" },
    { description: "فيلا سكنية، حي الملقا، 620 م²", value: 3050000, source: "تقرير تقييم سابق" },
    { description: "فيلا مستقلة، حي العارض، 700 م²", value: 3400000, source: "وزارة العدل" },
  ];

  const buildContext = () => ({
    ...ctx,
    estimatedValue: Number(ctx.estimatedValue) || 0,
    comparables,
  });

  const updateCtx = (key: string, value: string) => setCtx((p) => ({ ...p, [key]: value }));

  /* ─── Handlers ─── */

  const handleGenerateAll = useCallback(async () => {
    setIsGenerating(true);
    setStreamOutput("");
    streamRef.current = "";
    setStep(1);

    streamReportContent(
      { mode: "full_report", context: buildContext() },
      (delta) => {
        streamRef.current += delta;
        setStreamOutput(streamRef.current);
      },
      () => {
        setIsGenerating(false);
        setStep(2);
        toast.success("تم توليد مسودة التقرير الكاملة");
      },
      (err) => {
        setIsGenerating(false);
        setStep(0);
        toast.error(err);
      }
    );
  }, [ctx]);

  const handleGenerateStructured = useCallback(async () => {
    setIsGenerating(true);
    setStep(1);
    try {
      const keys = GENERABLE_SECTIONS.map((s) => s.key);
      const sections = await generateStructuredSections(buildContext(), keys);
      setGeneratedSections(sections);
      setIsGenerating(false);
      setStep(2);
      toast.success("تم توليد جميع الأقسام بنجاح");
    } catch (err: any) {
      setIsGenerating(false);
      setStep(0);
      toast.error(err.message || "خطأ في التوليد");
    }
  }, [ctx]);

  const handleRegenerateSection = useCallback(async (sectionKey: string) => {
    setIsGenerating(true);
    try {
      const sections = await generateStructuredSections(buildContext(), [sectionKey]);
      setGeneratedSections((prev) => ({ ...prev, ...sections }));
      toast.success("تم إعادة توليد القسم");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsGenerating(false);
    }
  }, [ctx]);

  const handleSaveEdit = (sectionKey: string) => {
    setGeneratedSections((prev) => ({ ...prev, [`${sectionKey}_ar`]: editBuffer }));
    setEditingSection(null);
    setEditBuffer("");
    toast.success("تم حفظ التعديل");
  };

  const handleReviewAll = useCallback(() => {
    setIsReviewing(true);
    setReviewOutput("");
    reviewRef.current = "";
    setStep(3);

    const allText = Object.entries(generatedSections)
      .filter(([k]) => k.endsWith("_ar"))
      .map(([k, v]) => `## ${k.replace("_ar", "")}\n${v}`)
      .join("\n\n");

    streamReportContent(
      { mode: "review", existingText: allText, context: buildContext() },
      (delta) => {
        reviewRef.current += delta;
        setReviewOutput(reviewRef.current);
      },
      () => {
        setIsReviewing(false);
        toast.success("تم فحص الجودة");
      },
      (err) => {
        setIsReviewing(false);
        toast.error(err);
      }
    );
  }, [generatedSections, ctx]);

  const handleCreateDraft = () => {
    toast.success("تم إنشاء مسودة التقرير بنجاح");
    navigate("/reports/generate");
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  const sectionCount = Object.keys(generatedSections).filter((k) => k.endsWith("_ar")).length;
  const hasStructuredData = sectionCount > 0;
  const hasStreamData = streamOutput.length > 0;

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
            <p className="text-sm text-muted-foreground">رقيم يُنشئ مسودة تقرير تقييم كاملة من البيانات المتاحة</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1 text-xs">
          <FileText className="w-3 h-3" />
          {ctx.referenceNumber}
        </Badge>
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
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        done
                          ? "bg-primary border-primary text-primary-foreground"
                          : active
                          ? "border-primary text-primary bg-primary/10 shadow-md shadow-primary/20"
                          : "border-muted-foreground/20 text-muted-foreground/40 bg-muted/20"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4.5 h-4.5" />
                      ) : active && isGenerating ? (
                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      ) : (
                        <Icon className="w-4.5 h-4.5" />
                      )}
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

      {/* ─── Step 0: Data Collection ─── */}
      {step === 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                بيانات التقييم
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { key: "clientName", label: "العميل" },
                  { key: "clientIdNumber", label: "رقم الهوية / السجل" },
                  { key: "purposeOfValuation", label: "غرض التقييم" },
                  { key: "assetDescription", label: "وصف العقار", span: 2 },
                  { key: "assetLocation", label: "العنوان" },
                  { key: "assetCity", label: "المدينة" },
                  { key: "propertyType", label: "نوع العقار" },
                  { key: "ownershipType", label: "نوع الملكية" },
                  { key: "landArea", label: "مساحة الأرض (م²)" },
                  { key: "buildingArea", label: "مساحة البناء (م²)" },
                  { key: "estimatedValue", label: "القيمة المقدرة (ر.س)" },
                  { key: "inspectionDate", label: "تاريخ المعاينة" },
                  { key: "valuationDate", label: "تاريخ التقييم" },
                  { key: "referenceNumber", label: "الرقم المرجعي" },
                ].map(({ key, label, span }) => (
                  <div key={key} className={`space-y-1.5 ${span ? `md:col-span-${span}` : ""}`}>
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input
                      value={(ctx as any)[key]}
                      onChange={(e) => updateCtx(key, e.target.value)}
                      className="text-sm"
                    />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">نوع الأصل</Label>
                  <Select value={ctx.assetType} onValueChange={(v) => updateCtx("assetType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="real_estate">عقاري</SelectItem>
                      <SelectItem value="equipment">آلات ومعدات</SelectItem>
                      <SelectItem value="vehicle">مركبات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">المنهجية</Label>
                  <Select value={ctx.methodology} onValueChange={(v) => updateCtx("methodology", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="market_comparison">أسلوب المقارنة</SelectItem>
                      <SelectItem value="income">أسلوب الدخل</SelectItem>
                      <SelectItem value="cost">أسلوب التكلفة</SelectItem>
                      <SelectItem value="combined">مختلط</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">ملخص المعاينة الميدانية</Label>
                  <Textarea value={ctx.inspectionSummary} onChange={(e) => updateCtx("inspectionSummary", e.target.value)} rows={2} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparables Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                المقارنات السوقية ({comparables.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {comparables.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-sm">
                    <div>
                      <span className="font-medium">{c.description}</span>
                      <span className="text-xs text-muted-foreground mr-2">({c.source})</span>
                    </div>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {c.value.toLocaleString()} ر.س
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Generate Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
            <Button size="lg" className="gap-2 min-w-[220px]" onClick={handleGenerateStructured}>
              <Wand2 className="w-4 h-4" />
              توليد أقسام مهيكلة
            </Button>
            <span className="text-xs text-muted-foreground">أو</span>
            <Button size="lg" variant="outline" className="gap-2 min-w-[220px]" onClick={handleGenerateAll}>
              <FileText className="w-4 h-4" />
              توليد تقرير نصي كامل
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 1: Generating ─── */}
      {step === 1 && (
        <Card className="border-primary/20">
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-foreground">جارٍ توليد التقرير...</h3>
              <p className="text-sm text-muted-foreground mt-1">رقيم يحلل البيانات ويكتب أقسام التقرير وفقاً لمعايير IVS 2025</p>
            </div>
            {streamOutput && (
              <div className="mt-6 text-right">
                <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                  <ReactMarkdown>{streamOutput}</ReactMarkdown>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Step 2: Section Review ─── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              أقسام التقرير المُولّدة
              {hasStructuredData && (
                <Badge variant="secondary" className="text-[10px]">{sectionCount} قسم</Badge>
              )}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(0)} className="gap-1">
                <ArrowRight className="w-3 h-3" />
                رجوع
              </Button>
              <Button size="sm" onClick={() => hasStructuredData ? handleReviewAll() : setStep(3)} className="gap-1">
                فحص الجودة
                <ArrowLeft className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Structured sections */}
          {hasStructuredData && (
            <div className="space-y-2">
              {GENERABLE_SECTIONS.map((sec) => {
                const arKey = `${sec.key}_ar`;
                const content = generatedSections[arKey];
                const isExpanded = expandedSection === sec.key;
                const isEditing = editingSection === sec.key;

                return (
                  <Card key={sec.key} className={`transition-all ${content ? "" : "opacity-50"}`}>
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedSection(isExpanded ? null : sec.key)}
                    >
                      <div className="flex items-center gap-2">
                        {content ? (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-sm">{sec.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {content && (
                          <Badge variant="secondary" className="text-[9px]">
                            {content.length} حرف
                          </Badge>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                    {isExpanded && content && (
                      <CardContent className="pt-0 space-y-3">
                        <Separator />
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editBuffer}
                              onChange={(e) => setEditBuffer(e.target.value)}
                              rows={8}
                              className="text-sm"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" size="sm" onClick={() => setEditingSection(null)}>إلغاء</Button>
                              <Button size="sm" onClick={() => handleSaveEdit(sec.key)}>حفظ</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-right bg-muted/20 rounded-lg p-3 max-h-[250px] overflow-y-auto">
                              <ReactMarkdown>{content}</ReactMarkdown>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => handleCopy(content)}>
                                <Copy className="w-3 h-3" />
                                نسخ
                              </Button>
                              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { setEditingSection(sec.key); setEditBuffer(content); }}>
                                <Edit3 className="w-3 h-3" />
                                تعديل
                              </Button>
                              <Button variant="ghost" size="sm" className="gap-1 text-xs" disabled={isGenerating} onClick={() => handleRegenerateSection(sec.key)}>
                                <RefreshCw className={`w-3 h-3 ${isGenerating ? "animate-spin" : ""}`} />
                                إعادة توليد
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
          )}

          {/* Stream output (non-structured) */}
          {!hasStructuredData && hasStreamData && (
            <Card>
              <CardContent className="pt-4">
                <div className="prose prose-sm dark:prose-invert max-w-none text-right bg-muted/20 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  <ReactMarkdown>{streamOutput}</ReactMarkdown>
                </div>
                <div className="flex gap-2 justify-end mt-3">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => handleCopy(streamOutput)}>
                    <Copy className="w-3 h-3" />
                    نسخ الكل
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Step 3: Quality Review ─── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              فحص الجودة والامتثال
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-1">
                <ArrowRight className="w-3 h-3" />
                رجوع
              </Button>
              <Button size="sm" onClick={() => setStep(4)} className="gap-1" disabled={isReviewing}>
                التالي
                <ArrowLeft className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {!isReviewing && !reviewOutput && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center space-y-3">
                <Eye className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">رقيم سيراجع جميع الأقسام ويقدّم تقرير جودة شامل</p>
                <Button className="gap-2" onClick={handleReviewAll}>
                  <Sparkles className="w-4 h-4" />
                  بدء فحص الجودة
                </Button>
              </CardContent>
            </Card>
          )}

          {(isReviewing || reviewOutput) && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  تقرير الجودة
                  {isReviewing && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      جارٍ المراجعة
                    </Badge>
                  )}
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

      {/* ─── Step 4: Preview ─── */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              معاينة التقرير
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(3)} className="gap-1">
                <ArrowRight className="w-3 h-3" />
                رجوع
              </Button>
              <Button size="sm" onClick={() => setStep(5)} className="gap-1">
                إنشاء المسودة
                <ArrowLeft className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* Quick summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "العميل", value: ctx.clientName },
                  { label: "العقار", value: ctx.propertyType + " — " + ctx.assetCity },
                  { label: "المنهجية", value: ctx.methodology === "market_comparison" ? "أسلوب المقارنة" : ctx.methodology === "income" ? "أسلوب الدخل" : ctx.methodology === "cost" ? "أسلوب التكلفة" : "مختلط" },
                  { label: "القيمة", value: Number(ctx.estimatedValue).toLocaleString() + " ر.س" },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-lg bg-muted/40">
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-bold mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Sections preview */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {hasStructuredData ? (
                  GENERABLE_SECTIONS.filter((s) => generatedSections[`${s.key}_ar`]).map((sec) => (
                    <div key={sec.key} className="p-3 rounded-lg bg-muted/20">
                      <h4 className="text-sm font-bold text-primary mb-1">{sec.label}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {generatedSections[`${sec.key}_ar`]?.substring(0, 200)}...
                      </p>
                    </div>
                  ))
                ) : hasStreamData ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-right">
                    <ReactMarkdown>{streamOutput.substring(0, 1500) + "\n\n..."}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات للمعاينة</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Step 5: Export ─── */}
      {step === 5 && (
        <div className="space-y-4">
          <Card className="border-primary/20">
            <CardContent className="py-10 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">التقرير جاهز للإنشاء</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  تم توليد ومراجعة جميع أقسام التقرير. يمكنك الآن إنشاء مسودة رسمية في نظام التقارير.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-center">
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-2xl font-bold text-primary">{sectionCount || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">أقسام مُولّدة</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-2xl font-bold text-primary">{comparables.length}</p>
                  <p className="text-[10px] text-muted-foreground">مقارنات سوقية</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-2xl font-bold text-primary">IVS</p>
                  <p className="text-[10px] text-muted-foreground">معايير 2025</p>
                </div>
              </div>

              <div className="flex gap-3 justify-center pt-2">
                <Button variant="outline" className="gap-2" onClick={() => setStep(2)}>
                  <Edit3 className="w-4 h-4" />
                  تعديل الأقسام
                </Button>
                <Button size="lg" className="gap-2" onClick={handleCreateDraft}>
                  <FileText className="w-4 h-4" />
                  إنشاء مسودة التقرير
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
