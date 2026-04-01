import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";

type Mode = "full_report" | "section" | "review";
type GenerationStep = "idle" | "generating" | "done";

const SECTION_OPTIONS = [
  { key: "executive_summary", label: "الملخص التنفيذي" },
  { key: "asset_description", label: "وصف الأصل" },
  { key: "market_analysis", label: "تحليل السوق" },
  { key: "methodology", label: "المنهجية المتبعة" },
  { key: "valuation", label: "التقييم والقيمة" },
  { key: "assumptions", label: "الافتراضات والشروط المقيّدة" },
  { key: "recommendations", label: "التوصيات" },
];

const STEPS = [
  { key: "context", label: "بيانات الأصل", icon: ClipboardList },
  { key: "generate", label: "التوليد", icon: Wand2 },
  { key: "review", label: "المراجعة", icon: Eye },
  { key: "done", label: "جاهز", icon: CheckCircle2 },
];

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

export default function AIReportGenerationPage() {
  const [activeTab, setActiveTab] = useState<string>("full");
  const [stepperIdx, setStepperIdx] = useState(0);
  const [genState, setGenState] = useState<GenerationStep>("idle");
  const [output, setOutput] = useState("");
  const outputRef = useRef("");

  // Context fields
  const [assetType, setAssetType] = useState("real_estate");
  const [assetDesc, setAssetDesc] = useState("فيلا سكنية مكونة من دورين ومجلس خارجي");
  const [assetLoc, setAssetLoc] = useState("حي النرجس، الرياض");
  const [methodology, setMethodology] = useState("market_comparison");
  const [estimatedValue, setEstimatedValue] = useState("2500000");
  const [clientName, setClientName] = useState("شركة الراجحي للتطوير العقاري");
  const [inspectionSummary, setInspectionSummary] = useState("حالة جيدة، تشطيبات فاخرة، بدون عيوب إنشائية");

  // Section mode
  const [selectedSection, setSelectedSection] = useState("executive_summary");

  // Review mode
  const [reviewText, setReviewText] = useState("");

  const buildContext = () => ({
    assetType,
    assetDescription: assetDesc,
    assetLocation: assetLoc,
    methodology,
    estimatedValue: Number(estimatedValue) || 0,
    clientName,
    inspectionSummary,
    comparables: [
      { description: "فيلا مماثلة في حي الياسمين", value: 2350000 },
      { description: "فيلا مماثلة في حي الملقا", value: 2650000 },
      { description: "فيلا مماثلة في حي النرجس", value: 2480000 },
    ],
  });

  const handleGenerate = useCallback(
    (mode: Mode, sectionKey?: string, existingText?: string) => {
      setGenState("generating");
      setOutput("");
      outputRef.current = "";
      setStepperIdx(1);

      streamReportContent(
        { mode, sectionKey, existingText, context: buildContext() },
        (delta) => {
          outputRef.current += delta;
          setOutput(outputRef.current);
        },
        () => {
          setGenState("done");
          setStepperIdx(3);
          toast.success("تم توليد المحتوى بنجاح");
        },
        (err) => {
          setGenState("idle");
          setStepperIdx(0);
          toast.error(err);
        }
      );
    },
    [assetType, assetDesc, assetLoc, methodology, estimatedValue, clientName, inspectionSummary]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    toast.success("تم النسخ");
  };

  const handleReset = () => {
    setOutput("");
    outputRef.current = "";
    setGenState("idle");
    setStepperIdx(0);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">توليد التقرير بالذكاء الاصطناعي</h1>
          <p className="text-sm text-muted-foreground">رقيم يكتب ويراجع تقارير التقييم وفقاً لمعايير IVS 2025</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between max-w-xl mx-auto">
        {STEPS.map((step, idx) => {
          const done = idx < stepperIdx || (idx === 3 && genState === "done");
          const active = idx === stepperIdx;
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                    done
                      ? "bg-primary border-primary text-primary-foreground"
                      : active
                      ? "border-primary text-primary bg-primary/10"
                      : "border-muted-foreground/30 text-muted-foreground/50 bg-muted/30"
                  }`}
                >
                  {done ? <CheckCircle2 className="w-4 h-4" /> : active && genState === "generating" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${done || active ? "text-primary" : "text-muted-foreground/50"}`}>
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="flex-1 mx-2">
                  <div className={`h-0.5 rounded-full transition-all ${idx < stepperIdx ? "bg-primary" : "bg-muted-foreground/20"}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); handleReset(); }}>
        <TabsList className="grid grid-cols-3 w-full max-w-lg mx-auto">
          <TabsTrigger value="full" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            تقرير كامل
          </TabsTrigger>
          <TabsTrigger value="section" className="gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            قسم محدد
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            مراجعة نص
          </TabsTrigger>
        </TabsList>

        {/* Context Card (shared) */}
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              بيانات الأصل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">نوع الأصل</Label>
                <Select value={assetType} onValueChange={setAssetType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="real_estate">عقاري</SelectItem>
                    <SelectItem value="equipment">آلات ومعدات</SelectItem>
                    <SelectItem value="vehicle">مركبات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">المنهجية</Label>
                <Select value={methodology} onValueChange={setMethodology}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market_comparison">أسلوب المقارنة</SelectItem>
                    <SelectItem value="income">أسلوب الدخل</SelectItem>
                    <SelectItem value="cost">أسلوب التكلفة</SelectItem>
                    <SelectItem value="combined">مختلط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">وصف الأصل</Label>
                <Input value={assetDesc} onChange={(e) => setAssetDesc(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">الموقع</Label>
                <Input value={assetLoc} onChange={(e) => setAssetLoc(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">القيمة المقدرة (ر.س)</Label>
                <Input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">العميل</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs">ملخص المعاينة</Label>
                <Textarea value={inspectionSummary} onChange={(e) => setInspectionSummary(e.target.value)} rows={2} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Full Report */}
        <TabsContent value="full" className="space-y-4 mt-4">
          <div className="flex justify-center">
            <Button
              size="lg"
              className="gap-2"
              disabled={genState === "generating"}
              onClick={() => handleGenerate("full_report")}
            >
              {genState === "generating" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              توليد التقرير الكامل
            </Button>
          </div>
        </TabsContent>

        {/* Section */}
        <TabsContent value="section" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-end gap-3 justify-center">
            <div className="space-y-1.5 w-64">
              <Label className="text-xs">القسم المطلوب</Label>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECTION_OPTIONS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="gap-2"
              disabled={genState === "generating"}
              onClick={() => handleGenerate("section", selectedSection)}
            >
              {genState === "generating" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              توليد القسم
            </Button>
          </div>
        </TabsContent>

        {/* Review */}
        <TabsContent value="review" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <Label className="text-xs">الصق نص التقرير للمراجعة</Label>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={6}
                placeholder="الصق نص القسم أو التقرير هنا..."
              />
              <div className="flex justify-center">
                <Button
                  className="gap-2"
                  disabled={genState === "generating" || !reviewText.trim()}
                  onClick={() => handleGenerate("review", undefined, reviewText)}
                >
                  {genState === "generating" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  مراجعة وتحسين
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Output */}
      {(output || genState === "generating") && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>نتيجة رقيم</span>
                {genState === "generating" && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    جارٍ التوليد
                  </Badge>
                )}
                {genState === "done" && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] border-0">
                    <CheckCircle2 className="w-3 h-3 ml-1" />
                    مكتمل
                  </Badge>
                )}
              </div>
              {genState === "done" && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleCopy}>
                    <Copy className="w-3 h-3" />
                    نسخ
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleReset}>
                    <RefreshCw className="w-3 h-3" />
                    إعادة
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none text-right leading-relaxed bg-muted/30 rounded-lg p-4 max-h-[500px] overflow-y-auto">
              <ReactMarkdown>{output || "..."}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
