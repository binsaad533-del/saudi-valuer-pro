import { useState, useEffect } from "react";
import {
  BarChart3, TrendingUp, CheckCircle, AlertTriangle,
  BookOpen, Scale, MessageSquare, Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalKnowledge: number;
  activeKnowledge: number;
  totalCorrections: number;
  activeCorrections: number;
  totalRules: number;
  activeRules: number;
  mandatoryRules: number;
  totalTests: number;
  avgAccuracy: number;
  totalAuditLogs: number;
  correctionsByType: Record<string, number>;
  knowledgeByCategory: Record<string, number>;
}

export default function PerformanceDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [knowledge, corrections, rules, tests, auditLogs] = await Promise.all([
        supabase.from("raqeem_knowledge").select("id, is_active, category"),
        supabase.from("raqeem_corrections").select("id, is_active, correction_type"),
        supabase.from("raqeem_rules").select("id, is_active, priority"),
        supabase.from("raqeem_test_sessions").select("id, accuracy_score"),
        supabase.from("raqeem_audit_log").select("id"),
      ]);

      const knowledgeData = (knowledge.data as any[]) || [];
      const correctionsData = (corrections.data as any[]) || [];
      const rulesData = (rules.data as any[]) || [];
      const testsData = (tests.data as any[]) || [];
      const auditData = (auditLogs.data as any[]) || [];

      const correctionsByType: Record<string, number> = {};
      correctionsData.forEach((c) => {
        const t = c.correction_type || "reasoning";
        correctionsByType[t] = (correctionsByType[t] || 0) + 1;
      });

      const knowledgeByCategory: Record<string, number> = {};
      knowledgeData.forEach((k) => {
        knowledgeByCategory[k.category] = (knowledgeByCategory[k.category] || 0) + 1;
      });

      const avgAccuracy = testsData.length > 0
        ? testsData.reduce((sum, t) => sum + Number(t.accuracy_score), 0) / testsData.length
        : 0;

      setStats({
        totalKnowledge: knowledgeData.length,
        activeKnowledge: knowledgeData.filter((k) => k.is_active).length,
        totalCorrections: correctionsData.length,
        activeCorrections: correctionsData.filter((c) => c.is_active).length,
        totalRules: rulesData.length,
        activeRules: rulesData.filter((r) => r.is_active).length,
        mandatoryRules: rulesData.filter((r) => r.priority >= 10).length,
        totalTests: testsData.length,
        avgAccuracy: Math.round(avgAccuracy * 100) / 100,
        totalAuditLogs: auditData.length,
        correctionsByType,
        knowledgeByCategory,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-12">جاري التحميل...</p>;
  }

  if (!stats) return null;

  const CORRECTION_TYPE_LABELS: Record<string, string> = {
    wrong_method: "منهجية خاطئة",
    wrong_calculation: "حساب خاطئ",
    poor_reasoning: "استنتاج ضعيف",
    missing_info: "معلومات ناقصة",
    wrong_standard: "معيار خاطئ",
    reasoning: "تحسين عام",
  };

  const KNOWLEDGE_LABELS: Record<string, string> = {
    ivs_standards: "معايير IVS",
    taqeem_standards: "معايير تقييم",
    internal_policies: "سياسات داخلية",
    past_reports: "تقارير سابقة",
    regulations: "أنظمة",
    general: "عام",
    standards: "معايير",
    policies: "سياسات",
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-foreground">لوحة الأداء</h3>
        <p className="text-xs text-muted-foreground">نظرة شاملة على حالة معرفة رقيم وأدائه</p>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: BookOpen, label: "مستندات المعرفة", value: stats.totalKnowledge, sub: `${stats.activeKnowledge} فعّال`, color: "text-primary" },
          { icon: MessageSquare, label: "التصحيحات", value: stats.totalCorrections, sub: `${stats.activeCorrections} فعّال`, color: "text-amber-600" },
          { icon: Scale, label: "القواعد", value: stats.totalRules, sub: `${stats.mandatoryRules} إلزامية`, color: "text-green-600" },
          { icon: Activity, label: "الاختبارات", value: stats.totalTests, sub: stats.totalTests > 0 ? `دقة ${stats.avgAccuracy}%` : "لا اختبارات", color: "text-purple-600" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <div className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{kpi.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Accuracy Score Card */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> مؤشر الدقة والتحسن
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full border-4 border-primary flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {stats.totalTests > 0 ? `${stats.avgAccuracy}%` : "—"}
                </div>
                <div className="text-[9px] text-muted-foreground">دقة</div>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">تصحيحات مُطبّقة</span>
                <span className="font-medium text-foreground">{stats.activeCorrections}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">قواعد إلزامية</span>
                <span className="font-medium text-foreground">{stats.mandatoryRules}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">سجلات التدقيق</span>
                <span className="font-medium text-foreground">{stats.totalAuditLogs}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">التعلم الذاتي</span>
                <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                  معطّل
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Corrections breakdown */}
      {Object.keys(stats.correctionsByType).length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> توزيع التصحيحات حسب النوع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.correctionsByType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-32 truncate">
                      {CORRECTION_TYPE_LABELS[type] || type}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min((count / stats.totalCorrections) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-foreground w-8 text-left">{count}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Knowledge breakdown */}
      {Object.keys(stats.knowledgeByCategory).length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> توزيع المعرفة حسب التصنيف
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.knowledgeByCategory).map(([cat, count]) => (
                <Badge key={cat} variant="secondary" className="text-xs gap-1 py-1">
                  {KNOWLEDGE_LABELS[cat] || cat}
                  <span className="bg-primary/20 text-primary rounded-full px-1.5 text-[10px] font-bold">{count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Control Status */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <h4 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> حالة التحكم
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "التعلم الذاتي", status: "معطّل", ok: true },
              { label: "تحديث تلقائي", status: "محظور", ok: true },
              { label: "مصادر خارجية", status: "محظورة", ok: true },
              { label: "سجل التدقيق", status: "مفعّل", ok: true },
              { label: "التحكم الإداري", status: "كامل", ok: true },
              { label: "شفافية المصادر", status: "إلزامية", ok: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                <span className="text-foreground">{item.label}:</span>
                <span className="text-muted-foreground text-xs">{item.status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
