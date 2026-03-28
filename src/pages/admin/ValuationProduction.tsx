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
  FileText, Shield, Brain, BarChart3, Scale, Building2,
  Download, Lock, Eye, ChevronLeft,
} from "lucide-react";

const PIPELINE_STEPS = [
  { key: "normalize", label: "تطبيع البيانات", icon: Building2 },
  { key: "market", label: "تحليل السوق", icon: BarChart3 },
  { key: "hbu", label: "الاستخدام الأعلى والأفضل", icon: Brain },
  { key: "valuation", label: "أساليب التقييم", icon: Scale },
  { key: "reconciliation", label: "التسوية والقيمة", icon: CheckCircle },
  { key: "report", label: "إنشاء التقرير", icon: FileText },
  { key: "compliance", label: "فحص الامتثال", icon: Shield },
];

export default function ValuationProduction() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [assignment, setAssignment] = useState<any>(null);
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

  useEffect(() => {
    if (assignmentId) loadData();
  }, [assignmentId]);

  const loadData = async () => {
    setLoading(true);
    const [aRes, rRes, mRes, recRes] = await Promise.all([
      supabase.from("valuation_assignments").select("*").eq("id", assignmentId!).single(),
      supabase.from("reports").select("*").eq("assignment_id", assignmentId!).order("version", { ascending: false }),
      supabase.from("valuation_methods").select("*, valuation_calculations(*)").eq("assignment_id", assignmentId!),
      supabase.from("reconciliation_results").select("*").eq("assignment_id", assignmentId!).maybeSingle(),
    ]);
    setAssignment(aRes.data);
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
      // Simulate step progression with interval
      const stepInterval = setInterval(() => {
        setCurrentStep(prev => Math.min(prev + 1, PIPELINE_STEPS.length - 1));
      }, 4000);

      const result = await runFullValuation(assignmentId);
      clearInterval(stepInterval);
      setCurrentStep(PIPELINE_STEPS.length);
      setEngineResult(result);

      toast({
        title: "✅ اكتمل محرك التقييم",
        description: `القيمة النهائية: ${result.final_value?.toLocaleString()} ر.س — ${result.compliance.ready ? "جاهز للإصدار" : `${result.compliance.mandatory_failures} فحص فاشل`}`,
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

      const result = await generateReportPDF(assignmentId, reports[0].id, type);
      toast({
        title: type === "draft" ? "✅ تم إنشاء مسودة التقرير" : "✅ تم إصدار التقرير النهائي",
        description: type === "final" ? "تم التوقيع الإلكتروني وإضافة رمز QR" : "تم إضافة علامة DRAFT المائية",
      });
      await loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setter(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!assignment) {
    return <div className="text-center py-12 text-muted-foreground">لم يتم العثور على المهمة</div>;
  }

  const progress = running ? Math.min(((currentStep + 1) / PIPELINE_STEPS.length) * 100, 95) : (engineResult ? 100 : 0);

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
              <Brain className="w-5 h-5 text-primary" />
              محرك التقييم
            </h1>
            <p className="text-sm text-muted-foreground font-mono" dir="ltr">{assignment.reference_number}</p>
          </div>
        </div>
        <Badge variant="secondary">{assignment.status}</Badge>
      </div>

      <Tabs defaultValue="engine" dir="rtl">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="engine">محرك التقييم</TabsTrigger>
          <TabsTrigger value="results">النتائج</TabsTrigger>
          <TabsTrigger value="compliance">الامتثال</TabsTrigger>
          <TabsTrigger value="reports">التقارير</TabsTrigger>
        </TabsList>

        {/* Engine Tab */}
        <TabsContent value="engine" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                خط الإنتاج الذكي
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                يقوم المحرك بتنفيذ 7 خطوات متسلسلة: تطبيع البيانات → تحليل السوق → HBU → أساليب التقييم → التسوية → إنشاء التقرير → فحص الامتثال
              </p>

              {/* Pipeline visualization */}
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
                      <span className={`text-sm ${isActive ? "font-medium text-primary" : isDone ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
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

          {/* Engine Result Summary */}
          {engineResult && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  ملخص نتائج المحرك
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
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4" />
                  <span>الامتثال: {engineResult.compliance.passed}/{engineResult.compliance.total} فحص ناجح</span>
                  {engineResult.compliance.ready ? (
                    <Badge variant="default" className="bg-green-600">جاهز للإصدار</Badge>
                  ) : (
                    <Badge variant="destructive">{engineResult.compliance.mandatory_failures} فحص إلزامي فاشل</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4 mt-4">
          {/* Reconciliation */}
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
                      Range: {Number(recon.value_range_low).toLocaleString()} - {Number(recon.value_range_high).toLocaleString()} {recon.currency}
                    </p>
                  )}
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm mb-1">تبرير القيمة</h4>
                  <p className="text-sm text-muted-foreground">{recon.reasoning_ar}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Methods */}
          {methods.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">أساليب التقييم المستخدمة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {methods.map((m: any) => (
                  <div key={m.id} className={`p-3 rounded-lg border ${m.is_used ? "bg-muted/30" : "bg-muted/10 opacity-60"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {m.is_used ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-medium text-sm">{m.approach}</span>
                        {m.is_primary && <Badge variant="default" className="text-[10px] h-4">رئيسي</Badge>}
                      </div>
                      {m.concluded_value > 0 && (
                        <span className="font-mono text-sm" dir="ltr">{Number(m.concluded_value).toLocaleString()} SAR</span>
                      )}
                    </div>
                    {m.reason_for_use_ar && <p className="text-xs text-muted-foreground mt-1">{m.reason_for_use_ar}</p>}
                    {m.weight_in_reconciliation > 0 && <p className="text-xs text-muted-foreground">الوزن: {(m.weight_in_reconciliation * 100).toFixed(0)}%</p>}
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
                فحص الامتثال - IVS 2025 / تقييم
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
                      <span className="font-medium">{compliance.mandatory_failures} فحص إلزامي فاشل — الإصدار مقفل</span>
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
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-yellow-600" />
                  مسودة التقرير
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">إنشاء مسودة مع علامة "DRAFT / مسودة" المائية</p>
                <Button
                  onClick={() => handleGenerateReport("draft")}
                  disabled={generatingDraft || !reports[0]}
                  className="w-full gap-2"
                  variant="outline"
                >
                  {generatingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  إنشاء مسودة التقرير
                </Button>
                {reports.find(r => r.status === "draft") && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>المسودة متاحة</span>
                    <Button size="sm" variant="ghost" className="mr-auto">
                      <Eye className="w-3 h-3" />
                    </Button>
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
                <p className="text-sm text-muted-foreground">تقرير نهائي مع توقيع إلكتروني ورمز QR</p>
                <Button
                  onClick={() => handleGenerateReport("final")}
                  disabled={generatingFinal || !reports[0] || (compliance ? !compliance.ready_for_issuance : true)}
                  className="w-full gap-2"
                >
                  {generatingFinal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  إصدار التقرير النهائي
                </Button>
                {(!compliance || !compliance.ready_for_issuance) && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    يجب اجتياز فحص الامتثال أولاً
                  </p>
                )}
                {reports.find(r => r.is_final) && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 dark:bg-green-950/20 p-2 rounded">
                    <CheckCircle className="w-4 h-4" />
                    <span>التقرير النهائي صادر</span>
                    <Button size="sm" variant="ghost" className="mr-auto">
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
