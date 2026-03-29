import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  runFullValuation,
  runComplianceCheck,
  generateReportPDF,
} from "@/lib/valuation-engine-api";
import type { ValuationEngineResult, ComplianceResult } from "@/lib/valuation-engine-api";
import {
  Loader2, Play, CheckCircle, XCircle, AlertTriangle,
  FileText, Shield, Brain, Scale,
  Download, Lock, Eye, ChevronLeft, Calculator, Search,
  TrendingUp, Info,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { InspectionAnalysisView } from "@/components/inspectors/InspectionAnalysisView";
import ReportLifecyclePanel from "@/components/reports/ReportLifecyclePanel";
import ValidationPanel from "@/components/validation/ValidationPanel";
import { Clipboard } from "lucide-react";

const PIPELINE_STEPS = [
  { key: "inspection", label: "تحليل المعاينة (AI)", icon: Clipboard, ai: true },
  { key: "classify", label: "تصنيف البيانات (AI)", icon: Brain, ai: true },
  { key: "adjustments", label: "اقتراح التعديلات (AI)", icon: TrendingUp, ai: true },
  { key: "hbu", label: "تحليل HBU (AI)", icon: Search, ai: true },
  { key: "decisions", label: "اختيار المنهجية (AI)", icon: Brain, ai: true },
  { key: "calculations", label: "الحسابات الحتمية (كود)", icon: Calculator, ai: false },
  { key: "reconciliation", label: "التسوية الحتمية (كود)", icon: Scale, ai: false },
  { key: "report", label: "كتابة التقرير (AI)", icon: FileText, ai: true },
  { key: "compliance", label: "فحص الامتثال (كود)", icon: Shield, ai: false },
];

export default function ValuationProduction() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [assignment, setAssignment] = useState<any>(null);
  const [inspection, setInspection] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [methods, setMethods] = useState<any[]>([]);
  const [recon, setRecon] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [engineResult, setEngineResult] = useState<ValuationEngineResult | null>(null);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [generatingFinal, setGeneratingFinal] = useState(false);
  const [auditExpanded, setAuditExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (assignmentId) loadData();
  }, [assignmentId]);

  const loadData = async () => {
    setLoading(true);
    const [aRes, rRes, mRes, recRes, insRes] = await Promise.all([
      supabase.from("valuation_assignments").select("*").eq("id", assignmentId!).single(),
      supabase.from("reports").select("*").eq("assignment_id", assignmentId!).order("version", { ascending: false }),
      supabase.from("valuation_methods").select("*, valuation_calculations(*)").eq("assignment_id", assignmentId!),
      supabase.from("reconciliation_results").select("*").eq("assignment_id", assignmentId!).maybeSingle(),
      supabase.from("inspections").select("*").eq("assignment_id", assignmentId!).order("created_at", { ascending: false }).limit(1),
    ]);
    setAssignment(aRes.data);
    setInspection((insRes.data as any)?.[0] || null);
    setReports(rRes.data || []);
    setMethods(mRes.data || []);
    setRecon(recRes.data);
    setLoading(false);
  };

  const runEngine = async () => {
    if (!assignmentId) return;
    setRunning(true);
    setCurrentStep(0);
    try {
      const stepInterval = setInterval(() => {
        setCurrentStep(prev => Math.min(prev + 1, PIPELINE_STEPS.length - 1));
      }, 3500);
      const result = await runFullValuation(assignmentId);
      clearInterval(stepInterval);
      setCurrentStep(PIPELINE_STEPS.length);
      setEngineResult(result);
      toast({
        title: "✅ اكتمل محرك التقييم",
        description: `القيمة النهائية: ${result.final_value?.toLocaleString()} ر.س`,
      });
      await loadData();
    } catch (err: any) {
      toast({ title: "خطأ في محرك التقييم", description: err.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const handleComplianceCheck = async () => {
    if (!assignmentId) return;
    try {
      const result = await runComplianceCheck(assignmentId);
      setCompliance(result);
      toast({
        title: result.ready_for_issuance ? "✅ جاهز للإصدار" : "⚠️ فحوصات فاشلة",
        description: `${result.passed}/${result.total} فحص ناجح`,
        variant: result.ready_for_issuance ? "default" : "destructive",
      });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  const handleGenerateReport = async (type: "draft" | "final") => {
    if (!assignmentId || !reports[0]) return;
    const setter = type === "draft" ? setGeneratingDraft : setGeneratingFinal;
    setter(true);
    try {
      if (type === "final" && compliance && !compliance.ready_for_issuance) {
        toast({ title: "لا يمكن إصدار التقرير النهائي", description: "يوجد فحوصات إلزامية فاشلة", variant: "destructive" });
        return;
      }
      await generateReportPDF(assignmentId, reports[0].id, type);
      toast({
        title: type === "draft" ? "✅ مسودة التقرير" : "✅ التقرير النهائي",
        description: type === "final" ? "تم التوقيع الإلكتروني" : "تم إضافة علامة DRAFT",
      });
      await loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setter(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!assignment) return <div className="text-center py-12 text-muted-foreground">لم يتم العثور على المهمة</div>;

  const progress = running ? Math.min(((currentStep + 1) / PIPELINE_STEPS.length) * 100, 95) : (engineResult ? 100 : 0);
  const auditTrail = (engineResult as any)?.audit_trail || [];
  const calcErrors = (engineResult as any)?.calculation_errors || [];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              محرك التقييم v2
            </h1>
            <p className="text-xs text-muted-foreground">حسابات حتمية + ذكاء اصطناعي محدود</p>
            <p className="text-sm text-muted-foreground font-mono" dir="ltr">{assignment.reference_number}</p>
          </div>
        </div>
        <Badge variant="secondary">{assignment.status}</Badge>
      </div>

      <Tabs defaultValue="engine" dir="rtl">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="engine">المحرك</TabsTrigger>
          <TabsTrigger value="inspection">المعاينة</TabsTrigger>
          <TabsTrigger value="audit">مسار التدقيق</TabsTrigger>
          <TabsTrigger value="results">النتائج</TabsTrigger>
          <TabsTrigger value="compliance">الامتثال</TabsTrigger>
          <TabsTrigger value="reports">التقارير</TabsTrigger>
        </TabsList>

        {/* Engine Tab */}
        <TabsContent value="engine" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                خط الإنتاج — الحسابات الحتمية + AI محدود
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Architecture info */}
              <div className="bg-muted/30 border border-border rounded-lg p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 font-medium"><Info className="w-4 h-4 text-primary" /> بنية المحرك المحدّثة</div>
                <p className="text-muted-foreground">• <span className="text-primary font-medium">الحسابات المالية</span>: كود حتمي — لا يتدخل فيها الذكاء الاصطناعي</p>
                <p className="text-muted-foreground">• <span className="text-primary font-medium">AI محدود</span>: تصنيف، اقتراح تعديلات (يتحقق منها النظام)، HBU، كتابة التقرير</p>
                <p className="text-muted-foreground">• <span className="text-primary font-medium">التعديلات</span>: ضمن نطاقات محددة (الموقع ±20%، المساحة ±15%، العمر -30%→0%، الحالة -20%→+10%)</p>
              </div>

              <div className="space-y-2">
                {PIPELINE_STEPS.map((step, i) => {
                  const Icon = step.icon;
                  const isActive = running && currentStep === i;
                  const isDone = currentStep > i || (!running && engineResult);
                  return (
                    <div key={step.key} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isActive ? "bg-primary/5 border-primary" : isDone ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-muted/30 border-border"}`}>
                      {isActive ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
                      ) : isDone ? (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className={`text-sm flex-1 ${isActive ? "font-medium text-primary" : isDone ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                      <Badge variant="outline" className={`text-[10px] h-5 ${step.ai ? "border-yellow-500 text-yellow-700 dark:text-yellow-400" : "border-blue-500 text-blue-700 dark:text-blue-400"}`}>
                        {step.ai ? "AI" : "كود"}
                      </Badge>
                    </div>
                  );
                })}
              </div>

              {running && <Progress value={progress} className="h-2" />}

              <Button onClick={runEngine} disabled={running} className="w-full gap-2" size="lg">
                {running ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />جاري التنفيذ... ({currentStep + 1}/{PIPELINE_STEPS.length})</>
                ) : engineResult ? (
                  <><Play className="w-4 h-4" />إعادة تشغيل المحرك</>
                ) : (
                  <><Play className="w-4 h-4" />تشغيل محرك التقييم</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quick result */}
          {engineResult && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  ملخص النتائج
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-primary/5 text-center">
                    <p className="text-sm text-muted-foreground">القيمة النهائية</p>
                    <p className="text-2xl font-bold text-primary" dir="ltr">{engineResult.final_value?.toLocaleString()} SAR</p>
                    <p className="text-xs text-muted-foreground mt-1">{engineResult.final_value_text_ar}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-sm text-muted-foreground">مستوى الثقة</p>
                    <Badge className={engineResult.confidence_level === "high" ? "bg-green-100 text-green-800" : engineResult.confidence_level === "moderate" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}>
                      {engineResult.confidence_level === "high" ? "عالي" : engineResult.confidence_level === "moderate" ? "متوسط" : "منخفض"}
                    </Badge>
                  </div>
                </div>
                {calcErrors.length > 0 && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-1">
                    <p className="text-sm font-medium text-destructive flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> تحذيرات الحسابات</p>
                    {calcErrors.map((e: string, i: number) => <p key={i} className="text-xs text-destructive/80">• {e}</p>)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Inspection Analysis Tab */}
        <TabsContent value="inspection" className="space-y-4 mt-4">
          {inspection ? (
            <InspectionAnalysisView
              inspectionId={inspection.id}
              assignmentId={assignmentId!}
              isAdmin={true}
            />
          ) : (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                <Clipboard className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>لا توجد معاينة مرتبطة بهذه المهمة</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Audit Trail Tab (Explainability Panel) */}
        <TabsContent value="audit" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                مسار التدقيق — كيف تم حساب القيمة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditTrail.length === 0 && methods.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">شغّل المحرك أولاً لعرض مسار التدقيق</p>
              ) : (
                <div className="space-y-4">
                  {/* Inline audit from engine result */}
                  {auditTrail.length > 0 && (
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 text-right">#</TableHead>
                            <TableHead className="text-right">الخطوة</TableHead>
                            <TableHead className="text-right">المعادلة</TableHead>
                            <TableHead className="text-right">المدخلات</TableHead>
                            <TableHead className="text-right">النتيجة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditTrail.map((s: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">{s.step}</TableCell>
                              <TableCell className="text-sm">{s.label_ar}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground" dir="ltr">{s.formula}</TableCell>
                              <TableCell className="text-xs">
                                <div className="max-w-48 overflow-hidden">
                                  {Object.entries(s.inputs || {}).map(([k, v]) => (
                                    <span key={k} className="inline-block bg-muted/50 rounded px-1 py-0.5 mr-1 mb-0.5 text-[10px]" dir="ltr">{k}={String(v)}</span>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono font-medium text-sm" dir="ltr">
                                {typeof s.result === "number" ? s.result.toLocaleString() : s.result} {s.unit}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* DB-stored calculations per method */}
                  {methods.filter(m => m.is_used).map((m: any) => (
                    <Collapsible key={m.id} open={auditExpanded[m.id]} onOpenChange={(open) => setAuditExpanded(prev => ({ ...prev, [m.id]: open }))}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-primary" />
                            <span className="font-medium text-sm">
                              {m.approach === "sales_comparison" ? "أسلوب المقارنة" : m.approach === "cost" ? "أسلوب التكلفة" : "أسلوب الدخل"}
                            </span>
                            {m.is_primary && <Badge variant="default" className="text-[10px] h-4">رئيسي</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm" dir="ltr">{Number(m.concluded_value).toLocaleString()} SAR</span>
                            <span className="text-xs text-muted-foreground">الوزن: {(Number(m.weight_in_reconciliation) * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        {m.reason_for_use_ar && (
                          <div className="bg-muted/20 rounded p-2 mb-2">
                            <p className="text-xs text-muted-foreground"><strong>السبب:</strong> {m.reason_for_use_ar}</p>
                          </div>
                        )}
                        {m.valuation_calculations?.length > 0 && (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10 text-right">#</TableHead>
                                <TableHead className="text-right">الخطوة</TableHead>
                                <TableHead className="text-right">المعادلة</TableHead>
                                <TableHead className="text-right">النتيجة</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {m.valuation_calculations.sort((a: any, b: any) => a.step_number - b.step_number).map((c: any) => (
                                <TableRow key={c.id}>
                                  <TableCell className="font-mono text-xs">{c.step_number}</TableCell>
                                  <TableCell className="text-sm">{c.label_ar}</TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground" dir="ltr">{c.formula}</TableCell>
                                  <TableCell className="font-mono font-medium" dir="ltr">{Number(c.result_value).toLocaleString()} {c.result_unit}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}

                  {/* Rejected methods */}
                  {methods.filter(m => !m.is_used).map((m: any) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-dashed opacity-60">
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">
                        {m.approach === "sales_comparison" ? "أسلوب المقارنة" : m.approach === "cost" ? "أسلوب التكلفة" : "أسلوب الدخل"}
                      </span>
                      <span className="text-xs text-muted-foreground mr-auto">مستبعد: {m.reason_for_rejection_ar}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Adjustment Rules Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">قواعد التعديلات المسموحة</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">نوع التعديل</TableHead>
                    <TableHead className="text-right">الحد الأدنى</TableHead>
                    <TableHead className="text-right">الحد الأعلى</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { name: "الموقع", min: "-20%", max: "+20%" },
                    { name: "المساحة", min: "-15%", max: "+15%" },
                    { name: "العمر", min: "-30%", max: "0%" },
                    { name: "الحالة", min: "-20%", max: "+10%" },
                    { name: "الوقت / اتجاه السوق", min: "-10%", max: "+15%" },
                  ].map(r => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono text-destructive">{r.min}</TableCell>
                      <TableCell className="font-mono text-green-600">{r.max}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-2">AI يقترح ← النظام يتحقق ويحد التعديلات ضمن هذه النطاقات تلقائياً</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4 mt-4">
          {recon && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">التسوية والقيمة النهائية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <p className="text-3xl font-bold text-primary" dir="ltr">{Number(recon.final_value).toLocaleString()} {recon.currency}</p>
                  <p className="text-sm text-muted-foreground mt-1">{recon.final_value_text_ar}</p>
                  {recon.value_range_low && recon.value_range_high && (
                    <p className="text-xs text-muted-foreground mt-2" dir="ltr">
                      {Number(recon.value_range_low).toLocaleString()} — {Number(recon.value_range_high).toLocaleString()} {recon.currency}
                    </p>
                  )}
                </div>
                <div className="bg-muted/20 rounded p-3 text-sm">
                  <p className="font-medium mb-1">معادلة التسوية:</p>
                  <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                    final = (market × w_market) + (cost × w_cost) + (income × w_income)
                  </p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm mb-1">تبرير القيمة</h4>
                  <p className="text-sm text-muted-foreground">{recon.reasoning_ar}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {methods.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">أساليب التقييم</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {methods.map((m: any) => (
                  <div key={m.id} className={`p-3 rounded-lg border ${m.is_used ? "bg-muted/30" : "bg-muted/10 opacity-60"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {m.is_used ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-medium text-sm">
                          {m.approach === "sales_comparison" ? "المقارنة" : m.approach === "cost" ? "التكلفة" : m.approach === "income" ? "الدخل" : m.approach}
                        </span>
                        {m.is_primary && <Badge variant="default" className="text-[10px] h-4">رئيسي</Badge>}
                      </div>
                      {Number(m.concluded_value) > 0 && (
                        <span className="font-mono text-sm" dir="ltr">{Number(m.concluded_value).toLocaleString()} SAR</span>
                      )}
                    </div>
                    {m.reason_for_use_ar && m.is_used && <p className="text-xs text-muted-foreground mt-1">{m.reason_for_use_ar}</p>}
                    {m.reason_for_rejection_ar && !m.is_used && <p className="text-xs text-muted-foreground mt-1">سبب الاستبعاد: {m.reason_for_rejection_ar}</p>}
                    {Number(m.weight_in_reconciliation) > 0 && <p className="text-xs text-muted-foreground">الوزن: {(Number(m.weight_in_reconciliation) * 100).toFixed(0)}%</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                فحص الامتثال — IVS 2025 / تقييم
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleComplianceCheck} className="gap-2">
                <Shield className="w-4 h-4" />
                تشغيل فحص الامتثال
              </Button>

              {compliance && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <Progress value={(compliance.passed / compliance.total) * 100} className="flex-1 h-3" />
                    <span className="text-sm font-mono">{compliance.passed}/{compliance.total}</span>
                  </div>

                  {compliance.ready_for_issuance ? (
                    <div className="flex items-center gap-2 text-green-700 bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">جاهز للإصدار النهائي</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-destructive bg-destructive/5 p-3 rounded-lg">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-medium">{compliance.mandatory_failures} فحص إلزامي فاشل</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    {compliance.checks.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/30">
                        <div className="flex items-center gap-2">
                          {c.passed ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                          <span>{c.name_ar}</span>
                          {c.mandatory && !c.passed && <Badge variant="destructive" className="text-[9px] h-3.5 px-1">إلزامي</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{c.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-5 h-5 text-yellow-600" />
                      مسودة التقرير
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">مسودة مع علامة DRAFT المائية</p>
                    <Button onClick={() => handleGenerateReport("draft")} disabled={generatingDraft || !reports[0]} className="w-full gap-2" variant="outline">
                      {generatingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      إنشاء مسودة
                    </Button>
                    {reports.find(r => r.status === "draft") && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                        <CheckCircle className="w-4 h-4 text-green-600" /><span>متاحة</span>
                        <Button size="sm" variant="ghost" className="mr-auto"><Eye className="w-3 h-3" /></Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-5 h-5 text-green-600" />
                      التقرير النهائي
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">توقيع إلكتروني + QR | صالح 90 يوم</p>
                    <Button onClick={() => handleGenerateReport("final")} disabled={generatingFinal || !reports[0] || (compliance ? !compliance.ready_for_issuance : true)} className="w-full gap-2">
                      {generatingFinal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      إصدار نهائي
                    </Button>
                    {(!compliance || !compliance.ready_for_issuance) && (
                      <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />يجب اجتياز فحص الامتثال</p>
                    )}
                    {reports.find(r => r.is_final) && (
                      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 dark:bg-green-950/20 p-2 rounded">
                        <CheckCircle className="w-4 h-4" /><span>صادر</span>
                        <Button size="sm" variant="ghost" className="mr-auto"><Download className="w-3 h-3" /></Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Report Lifecycle Sidebar */}
            <div>
              <ReportLifecyclePanel
                assignment={assignment}
                reports={reports}
                onRefresh={loadData}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
