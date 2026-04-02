import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Eye,
  BarChart3,
  ListChecks,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ComplianceCheck {
  id: string;
  assignment_id: string;
  check_code: string;
  check_name_ar: string;
  check_name_en: string | null;
  category: string;
  is_passed: boolean | null;
  is_mandatory: boolean | null;
  auto_checked: boolean | null;
  notes: string | null;
  checked_at: string | null;
}

interface AssignmentSummary {
  id: string;
  reference_number: string | null;
  status: string;
  valuation_type: string | null;
  checks: ComplianceCheck[];
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  mandatoryFailures: number;
  complianceRate: number;
}

interface OverallStats {
  totalAssignments: number;
  compliantAssignments: number;
  nonCompliantAssignments: number;
  pendingAssignments: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  mandatoryFailures: number;
  overallRate: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  input_data: "بيانات المدخلات",
  comparables: "المقارنات السوقية",
  adjustments: "التعديلات",
  results: "النتائج",
  method: "المنهجية",
  compliance: "الامتثال التنظيمي",
  status: "الحالة",
  approval: "الاعتماد",
  documentation: "التوثيق",
  inspection: "المعاينة",
};

export default function CompliancePage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [stats, setStats] = useState<OverallStats>({
    totalAssignments: 0,
    compliantAssignments: 0,
    nonCompliantAssignments: 0,
    pendingAssignments: 0,
    totalChecks: 0,
    passedChecks: 0,
    failedChecks: 0,
    mandatoryFailures: 0,
    overallRate: 0,
  });
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchComplianceData = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) setRefreshing(true);
      else setLoading(true);

      // Fetch all assignments with their compliance checks
      const { data: assignmentsData, error: assignErr } = await supabase
        .from("valuation_assignments")
        .select("id, reference_number, status, valuation_type")
        .order("created_at", { ascending: false });

      if (assignErr) throw assignErr;

      const { data: checksData, error: checksErr } = await supabase
        .from("compliance_checks")
        .select("*")
        .order("category", { ascending: true });

      if (checksErr) throw checksErr;

      // Group checks by assignment
      const checksMap = new Map<string, ComplianceCheck[]>();
      (checksData || []).forEach((check) => {
        const list = checksMap.get(check.assignment_id) || [];
        list.push(check);
        checksMap.set(check.assignment_id, list);
      });

      // Build assignment summaries
      const summaries: AssignmentSummary[] = (assignmentsData || []).map((a) => {
        const checks = checksMap.get(a.id) || [];
        const totalChecks = checks.length;
        const passedChecks = checks.filter((c) => c.is_passed).length;
        const failedChecks = checks.filter((c) => c.is_passed === false).length;
        const mandatoryFailures = checks.filter(
          (c) => c.is_mandatory && c.is_passed === false
        ).length;
        const complianceRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

        return {
          id: a.id,
          reference_number: a.reference_number,
          status: a.status || "draft",
          valuation_type: a.valuation_type,
          checks,
          totalChecks,
          passedChecks,
          failedChecks,
          mandatoryFailures,
          complianceRate,
        };
      });

      setAssignments(summaries);

      // Calculate overall stats
      const withChecks = summaries.filter((s) => s.totalChecks > 0);
      const compliant = withChecks.filter(
        (s) => s.mandatoryFailures === 0 && s.failedChecks === 0
      );
      const nonCompliant = withChecks.filter((s) => s.mandatoryFailures > 0);
      const pending = summaries.filter((s) => s.totalChecks === 0);

      const totalChecks = withChecks.reduce((sum, s) => sum + s.totalChecks, 0);
      const passedChecks = withChecks.reduce((sum, s) => sum + s.passedChecks, 0);
      const failedChecks = withChecks.reduce((sum, s) => sum + s.failedChecks, 0);
      const mandatoryFailures = withChecks.reduce(
        (sum, s) => sum + s.mandatoryFailures,
        0
      );

      setStats({
        totalAssignments: summaries.length,
        compliantAssignments: compliant.length,
        nonCompliantAssignments: nonCompliant.length,
        pendingAssignments: pending.length,
        totalChecks,
        passedChecks,
        failedChecks,
        mandatoryFailures,
        overallRate: totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0,
      });

      if (showRefreshToast) {
        toast({ title: "تم التحديث", description: "تم تحديث بيانات الامتثال بنجاح" });
      }
    } catch (err: any) {
      toast({
        title: "خطأ في تحميل البيانات",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const getStatusBadge = (summary: AssignmentSummary) => {
    if (summary.totalChecks === 0) {
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Clock className="w-3 h-3" /> لم يُفحص بعد
        </Badge>
      );
    }
    if (summary.mandatoryFailures > 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" /> غير ممتثل
        </Badge>
      );
    }
    if (summary.failedChecks > 0) {
      return (
        <Badge className="gap-1 bg-amber-500 hover:bg-amber-600 text-white">
          <AlertTriangle className="w-3 h-3" /> يحتاج مراجعة
        </Badge>
      );
    }
    return (
      <Badge className="gap-1 bg-green-600 hover:bg-green-700 text-white">
        <CheckCircle2 className="w-3 h-3" /> ممتثل
      </Badge>
    );
  };

  const getComplianceColor = (rate: number) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-amber-500";
    return "text-destructive";
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 90) return "[&>div]:bg-green-600";
    if (rate >= 70) return "[&>div]:bg-amber-500";
    return "[&>div]:bg-destructive";
  };

  const selectedData = assignments.find((a) => a.id === selectedAssignment);

  // Group selected assignment checks by category
  const checksByCategory = selectedData
    ? selectedData.checks.reduce((acc, check) => {
        const cat = check.category || "other";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(check);
        return acc;
      }, {} as Record<string, ComplianceCheck[]>)
    : {};

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">الامتثال والتوافق التنظيمي</h1>
            <p className="text-sm text-muted-foreground">
              مراقبة التوافق مع معايير التقييم الدولية (IVS) ومتطلبات تقييم
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchComplianceData(true)}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي التقييمات</p>
                <p className="text-3xl font-bold text-foreground">{stats.totalAssignments}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ممتثل</p>
                <p className="text-3xl font-bold text-green-600">{stats.compliantAssignments}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">غير ممتثل</p>
                <p className="text-3xl font-bold text-destructive">{stats.nonCompliantAssignments}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">لم يُفحص</p>
                <p className="text-3xl font-bold text-muted-foreground">{stats.pendingAssignments}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Compliance Rate */}
      {stats.totalChecks > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">معدل الامتثال الكلي</span>
              </div>
              <span className={`text-2xl font-bold ${getComplianceColor(stats.overallRate)}`}>
                {stats.overallRate.toFixed(1)}%
              </span>
            </div>
            <Progress value={stats.overallRate} className={`h-3 ${getProgressColor(stats.overallRate)}`} />
            <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
              <span>{stats.passedChecks} ناجح من {stats.totalChecks} فحص</span>
              {stats.mandatoryFailures > 0 && (
                <span className="text-destructive font-medium">
                  {stats.mandatoryFailures} إخفاق إلزامي
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assignments" className="gap-2">
            <ListChecks className="w-4 h-4" />
            حسب التقييم
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            حسب الفئة
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-4">
          {selectedAssignment && selectedData ? (
            // Detail view for a specific assignment
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAssignment(null)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                العودة للقائمة
              </Button>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      فحوصات الامتثال — {selectedData.reference_number || "بدون رقم"}
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(selectedData)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/valuations/${selectedData.id}`)}
                        className="gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        فتح التقييم
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedData.totalChecks === 0 ? (
                    <div className="text-center py-8">
                      <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        لم يتم تشغيل فحوصات الامتثال لهذا التقييم بعد.
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        يتم تشغيل الفحوصات تلقائياً عند تشغيل محرك التقييم أو يدوياً من صفحة التقييم.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Summary bar */}
                      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                        <div className="flex-1">
                          <Progress
                            value={selectedData.complianceRate}
                            className={`h-2 ${getProgressColor(selectedData.complianceRate)}`}
                          />
                        </div>
                        <span className={`font-bold ${getComplianceColor(selectedData.complianceRate)}`}>
                          {selectedData.complianceRate.toFixed(0)}%
                        </span>
                      </div>

                      {/* Checks by category */}
                      {Object.entries(checksByCategory).map(([category, checks]) => (
                        <div key={category}>
                          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            {CATEGORY_LABELS[category] || category}
                          </h3>
                          <div className="space-y-2">
                            {checks.map((check) => (
                              <div
                                key={check.id}
                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                  check.is_passed
                                    ? "border-green-200 bg-green-50/50"
                                    : check.is_passed === false
                                    ? "border-destructive/30 bg-destructive/5"
                                    : "border-border bg-muted/30"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  {check.is_passed ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                                  ) : check.is_passed === false ? (
                                    <XCircle className="w-5 h-5 text-destructive shrink-0" />
                                  ) : (
                                    <Clock className="w-5 h-5 text-muted-foreground shrink-0" />
                                  )}
                                  <div>
                                    <p className="text-sm font-medium text-foreground">
                                      {check.check_name_ar}
                                    </p>
                                    {check.notes && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {check.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {check.is_mandatory && (
                                    <Badge variant="outline" className="text-xs">
                                      إلزامي
                                    </Badge>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className="text-xs text-muted-foreground"
                                  >
                                    {check.check_code}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Separator className="mt-4" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            // List of all assignments
            <Card>
              <CardHeader>
                <CardTitle className="text-base">حالة الامتثال حسب التقييم</CardTitle>
              </CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">لا توجد تقييمات بعد</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ستظهر هنا حالة الامتثال لكل تقييم بمجرد إنشاء التقييمات وتشغيل الفحوصات
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4 gap-2"
                      onClick={() => navigate("/valuations/new")}
                    >
                      <FileText className="w-4 h-4" />
                      إنشاء تقييم جديد
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedAssignment(a.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              a.totalChecks === 0
                                ? "bg-muted"
                                : a.mandatoryFailures > 0
                                ? "bg-destructive/10"
                                : a.failedChecks > 0
                                ? "bg-amber-100"
                                : "bg-green-100"
                            }`}
                          >
                            {a.totalChecks === 0 ? (
                              <Clock className="w-5 h-5 text-muted-foreground" />
                            ) : a.mandatoryFailures > 0 ? (
                              <ShieldAlert className="w-5 h-5 text-destructive" />
                            ) : a.failedChecks > 0 ? (
                              <AlertTriangle className="w-5 h-5 text-amber-500" />
                            ) : (
                              <ShieldCheck className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {a.reference_number || `تقييم ${a.id.slice(0, 8)}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {a.totalChecks > 0
                                ? `${a.passedChecks}/${a.totalChecks} فحص ناجح`
                                : "لم يُفحص بعد"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {a.totalChecks > 0 && (
                            <div className="w-24">
                              <Progress
                                value={a.complianceRate}
                                className={`h-2 ${getProgressColor(a.complianceRate)}`}
                              />
                            </div>
                          )}
                          {getStatusBadge(a)}
                          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <ComplianceByCategoryView assignments={assignments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Sub-component: compliance breakdown by category
function ComplianceByCategoryView({ assignments }: { assignments: AssignmentSummary[] }) {
  const allChecks = assignments.flatMap((a) => a.checks);

  if (allChecks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">لا توجد فحوصات بعد لعرض التحليل حسب الفئة</p>
        </CardContent>
      </Card>
    );
  }

  // Group by category
  const categories = allChecks.reduce((acc, check) => {
    const cat = check.category || "other";
    if (!acc[cat]) acc[cat] = { total: 0, passed: 0, failed: 0, mandatory_failed: 0 };
    acc[cat].total++;
    if (check.is_passed) acc[cat].passed++;
    if (check.is_passed === false) {
      acc[cat].failed++;
      if (check.is_mandatory) acc[cat].mandatory_failed++;
    }
    return acc;
  }, {} as Record<string, { total: number; passed: number; failed: number; mandatory_failed: number }>);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(categories).map(([category, data]) => {
        const rate = data.total > 0 ? (data.passed / data.total) * 100 : 0;
        const color = rate >= 90 ? "green" : rate >= 70 ? "amber" : "red";

        return (
          <Card key={category}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground">
                  {CATEGORY_LABELS[category] || category}
                </h3>
                <span
                  className={`text-lg font-bold ${
                    color === "green"
                      ? "text-green-600"
                      : color === "amber"
                      ? "text-amber-500"
                      : "text-destructive"
                  }`}
                >
                  {rate.toFixed(0)}%
                </span>
              </div>
              <Progress
                value={rate}
                className={`h-2 mb-3 ${
                  color === "green"
                    ? "[&>div]:bg-green-600"
                    : color === "amber"
                    ? "[&>div]:bg-amber-500"
                    : "[&>div]:bg-destructive"
                }`}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-600" /> {data.passed} ناجح
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-destructive" /> {data.failed} راسب
                </span>
                {data.mandatory_failed > 0 && (
                  <span className="flex items-center gap-1 text-destructive font-medium">
                    <AlertTriangle className="w-3 h-3" /> {data.mandatory_failed} إلزامي
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
