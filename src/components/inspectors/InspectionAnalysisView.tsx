import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Brain, AlertTriangle, Shield, TrendingDown, Eye,
  Pencil, Save, RotateCcw, Loader2, CheckCircle,
  XCircle, Activity, Wrench, Building2,
} from "lucide-react";
import { triggerInspectionAnalysis, overrideAnalysis } from "@/lib/inspection-analysis-api";

interface Props {
  inspectionId: string;
  assignmentId: string;
  isAdmin?: boolean;
}

const CONDITION_COLORS: Record<string, string> = {
  excellent: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  good: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  fair: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  poor: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const CONDITION_LABELS: Record<string, string> = {
  excellent: "ممتاز",
  good: "جيد",
  fair: "متوسط",
  poor: "ضعيف",
};

const FINISHING_LABELS: Record<string, string> = {
  luxury: "فاخر",
  high: "عالي",
  standard: "عادي",
  basic: "بسيط",
  unfinished: "غير مكتمل",
};

export function InspectionAnalysisView({ inspectionId, assignmentId, isAdmin = false }: Props) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<any>({});

  useEffect(() => {
    loadAnalysis();
  }, [inspectionId]);

  const loadAnalysis = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inspection_analysis" as any)
      .select("*")
      .eq("inspection_id", inspectionId)
      .maybeSingle();
    setAnalysis(data);
    setLoading(false);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      await triggerInspectionAnalysis(inspectionId);
      toast.success("تم تحليل المعاينة بنجاح");
      await loadAnalysis();
    } catch (err: any) {
      toast.error(err.message || "فشل التحليل");
    } finally {
      setAnalyzing(false);
    }
  };

  const startEdit = () => {
    setEditData({
      condition_rating: analysis.condition_rating,
      condition_score: analysis.condition_score,
      quality_score: analysis.quality_score,
      finishing_level: analysis.finishing_level,
      physical_depreciation_pct: analysis.physical_depreciation_pct,
      functional_obsolescence_pct: analysis.functional_obsolescence_pct,
      external_obsolescence_pct: analysis.external_obsolescence_pct,
      condition_adjustment_pct: analysis.condition_adjustment_pct,
      override_notes: "",
    });
    setEditing(true);
  };

  const saveOverride = async () => {
    setSaving(true);
    try {
      await overrideAnalysis(analysis.id, editData);
      toast.success("تم حفظ التعديل");
      setEditing(false);
      await loadAnalysis();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            تحليل المعاينة بالذكاء الاصطناعي
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">لم يتم تحليل المعاينة بعد</p>
          <Button onClick={runAnalysis} disabled={analyzing} className="gap-2">
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {analyzing ? "جاري التحليل..." : "تشغيل التحليل"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const defects = (analysis.visible_defects as any[]) || [];
  const riskFlags = (analysis.risk_flags as any[]) || [];
  const photoInsights = (analysis.photo_analysis as any[]) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              نتائج تحليل المعاينة
            </CardTitle>
            <div className="flex items-center gap-2">
              {analysis.is_overridden && (
                <Badge variant="outline" className="text-yellow-700 border-yellow-500">
                  <Pencil className="w-3 h-3 ml-1" /> معدّل يدوياً
                </Badge>
              )}
              <Badge className={analysis.status === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                {analysis.status === "completed" ? "مكتمل" : "قيد المعالجة"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Scores Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">الحالة العامة</p>
              <Badge className={`mt-1 ${CONDITION_COLORS[analysis.condition_rating] || ""}`}>
                {CONDITION_LABELS[analysis.condition_rating] || analysis.condition_rating}
              </Badge>
              <p className="text-lg font-bold mt-1">{Number(analysis.condition_score).toFixed(1)}/10</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">مستوى التشطيب</p>
              <p className="text-sm font-medium mt-1">{FINISHING_LABELS[analysis.finishing_level] || analysis.finishing_level}</p>
              <p className="text-lg font-bold mt-1">{Number(analysis.quality_score).toFixed(1)}/10</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">العيوب</p>
              <p className="text-lg font-bold mt-1 text-destructive">{defects.length}</p>
              <p className="text-[10px] text-muted-foreground">عيب مكتشف</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">علامات خطر</p>
              <p className="text-lg font-bold mt-1 text-yellow-600">{riskFlags.length}</p>
              <p className="text-[10px] text-muted-foreground">تحذير</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Depreciation & Adjustments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-primary" />
            الإهلاك والتعديلات (مدخلات التقييم)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">الحالة</label>
                  <Select value={editData.condition_rating} onValueChange={v => setEditData((p: any) => ({ ...p, condition_rating: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">ممتاز</SelectItem>
                      <SelectItem value="good">جيد</SelectItem>
                      <SelectItem value="fair">متوسط</SelectItem>
                      <SelectItem value="poor">ضعيف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">درجة الحالة (1-10)</label>
                  <Input type="number" min={1} max={10} step={0.1} value={editData.condition_score}
                    onChange={e => setEditData((p: any) => ({ ...p, condition_score: parseFloat(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">الإهلاك المادي %</label>
                  <Input type="number" min={0} max={100} step={1}
                    value={Math.round((editData.physical_depreciation_pct || 0) * 100)}
                    onChange={e => setEditData((p: any) => ({ ...p, physical_depreciation_pct: parseInt(e.target.value) / 100 }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">التقادم الوظيفي %</label>
                  <Input type="number" min={0} max={30} step={1}
                    value={Math.round((editData.functional_obsolescence_pct || 0) * 100)}
                    onChange={e => setEditData((p: any) => ({ ...p, functional_obsolescence_pct: parseInt(e.target.value) / 100 }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">التقادم الخارجي %</label>
                  <Input type="number" min={0} max={20} step={1}
                    value={Math.round((editData.external_obsolescence_pct || 0) * 100)}
                    onChange={e => setEditData((p: any) => ({ ...p, external_obsolescence_pct: parseInt(e.target.value) / 100 }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">تعديل الحالة للمقارنات %</label>
                  <Input type="number" min={-20} max={10} step={1}
                    value={Math.round((editData.condition_adjustment_pct || 0) * 100)}
                    onChange={e => setEditData((p: any) => ({ ...p, condition_adjustment_pct: parseInt(e.target.value) / 100 }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">سبب التعديل</label>
                <Textarea value={editData.override_notes || ""}
                  onChange={e => setEditData((p: any) => ({ ...p, override_notes: e.target.value }))}
                  placeholder="اذكر سبب تعديل نتائج الذكاء الاصطناعي..." />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveOverride} disabled={saving} size="sm" className="gap-1">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  حفظ
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1">
                  <RotateCcw className="w-3 h-3" /> إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "الإهلاك المادي", value: analysis.physical_depreciation_pct, color: "text-red-600" },
                  { label: "التقادم الوظيفي", value: analysis.functional_obsolescence_pct, color: "text-orange-600" },
                  { label: "التقادم الخارجي", value: analysis.external_obsolescence_pct, color: "text-yellow-600" },
                  { label: "تعديل الحالة", value: analysis.condition_adjustment_pct, color: "text-blue-600" },
                ].map(item => (
                  <div key={item.label} className="p-2 rounded bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    <p className={`text-sm font-bold ${item.color}`}>
                      {(Number(item.value) * 100).toFixed(1)}%
                    </p>
                    <Progress value={Math.abs(Number(item.value)) * 100} className="h-1 mt-1" />
                  </div>
                ))}
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={startEdit} className="gap-1">
                  <Pencil className="w-3 h-3" /> تعديل النتائج
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Defects */}
      {defects.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              العيوب المكتشفة ({defects.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {defects.map((d: any, i: number) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded border bg-muted/20">
                <Badge variant="outline" className={
                  d.severity === "critical" ? "border-red-500 text-red-700" :
                  d.severity === "major" ? "border-orange-500 text-orange-700" :
                  d.severity === "moderate" ? "border-yellow-500 text-yellow-700" :
                  "border-gray-400 text-gray-600"
                }>
                  {d.severity === "critical" ? "حرج" : d.severity === "major" ? "رئيسي" : d.severity === "moderate" ? "متوسط" : "طفيف"}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm">{d.description_ar}</p>
                  {d.location_ar && <p className="text-xs text-muted-foreground">الموقع: {d.location_ar}</p>}
                </div>
                {d.estimated_repair_impact_pct != null && (
                  <span className="text-xs text-destructive font-mono">-{(d.estimated_repair_impact_pct * 100).toFixed(0)}%</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Risk Flags */}
      {riskFlags.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-yellow-600" />
              علامات الخطر ({riskFlags.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {riskFlags.map((f: any, i: number) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded border bg-yellow-50/50 dark:bg-yellow-900/10">
                <Badge variant="outline" className={
                  f.impact === "high" ? "border-red-400 text-red-600" :
                  f.impact === "medium" ? "border-yellow-400 text-yellow-600" :
                  "border-gray-300 text-gray-500"
                }>
                  {f.impact === "high" ? "عالي" : f.impact === "medium" ? "متوسط" : "منخفض"}
                </Badge>
                <p className="text-sm flex-1">{f.description_ar}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AI Reasoning */}
      {analysis.ai_reasoning_ar && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              تحليل الذكاء الاصطناعي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{analysis.ai_reasoning_ar}</p>
          </CardContent>
        </Card>
      )}

      {/* Re-run / Original data */}
      {isAdmin && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runAnalysis} disabled={analyzing} className="gap-1">
            {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            إعادة التحليل
          </Button>
          {analysis.is_overridden && analysis.original_ai_data && (
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => {
              toast.info(`النتائج الأصلية: الحالة ${(analysis.original_ai_data as any).condition_rating}, الدرجة ${(analysis.original_ai_data as any).condition_score}/10`);
            }}>
              <Eye className="w-3 h-3" /> عرض النتائج الأصلية
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
