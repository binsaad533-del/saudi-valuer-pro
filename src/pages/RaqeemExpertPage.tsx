import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { toast } from "sonner";
import {
  Shield, Activity, GitBranch, Zap, FileText,
  RefreshCw, CheckCircle, AlertTriangle, XCircle, Info,
  ChevronDown, ChevronUp, Eye, EyeOff, Wrench,
} from "lucide-react";

const PILLAR_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  architecture: { label: "البنية", icon: GitBranch, color: "text-blue-500" },
  workflow: { label: "سير العمل", icon: Activity, color: "text-purple-500" },
  performance: { label: "الأداء", icon: Zap, color: "text-amber-500" },
  security: { label: "الأمان", icon: Shield, color: "text-red-500" },
  code_quality: { label: "جودة الكود", icon: FileText, color: "text-cyan-500" },
  reporting: { label: "التقارير", icon: FileText, color: "text-green-500" },
};

const SEVERITY_MAP: Record<string, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  critical: { label: "حرج", icon: XCircle, bg: "bg-red-500/10", text: "text-red-600" },
  warning: { label: "تحذير", icon: AlertTriangle, bg: "bg-amber-500/10", text: "text-amber-600" },
  info: { label: "معلومة", icon: Info, bg: "bg-blue-500/10", text: "text-blue-600" },
  healthy: { label: "سليم", icon: CheckCircle, bg: "bg-green-500/10", text: "text-green-600" },
};

export default function RaqeemExpertPage() {
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [filterPillar, setFilterPillar] = useState<string>("all");
  const queryClient = useQueryClient();

  // Fetch latest scan
  const { data: latestScan, isLoading: scanLoading } = useQuery({
    queryKey: ["expert-latest-scan"],
    queryFn: async () => {
      const { data } = await supabase
        .from("raqeem_expert_scans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
  });

  // Fetch findings
  const { data: findings = [], isLoading: findingsLoading } = useQuery({
    queryKey: ["expert-findings", latestScan?.id],
    queryFn: async () => {
      if (!latestScan?.id) return [];
      const { data } = await supabase
        .from("raqeem_expert_findings")
        .select("*")
        .eq("scan_batch_id", latestScan.id)
        .order("severity", { ascending: true });
      return data || [];
    },
    enabled: !!latestScan?.id,
  });

  // Run scan mutation
  const runScan = useMutation({
    mutationFn: async (scanType: string) => {
      const { data, error } = await supabase.functions.invoke("raqeem-expert-engine", {
        body: { action: scanType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["expert-latest-scan"] });
      queryClient.invalidateQueries({ queryKey: ["expert-findings"] });
      toast.success(`تم الفحص بنجاح | النتيجة: ${data.health_score?.toFixed(0)}%`);
    },
    onError: (err) => toast.error(`فشل الفحص: ${err.message}`),
  });

  // Update finding status
  const updateFinding = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("raqeem_expert_findings")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expert-findings"] });
      toast.success("تم تحديث الحالة");
    },
  });

  const filteredFindings = filterPillar === "all"
    ? findings
    : findings.filter((f: any) => f.pillar === filterPillar);

  const pillarScores = (latestScan?.pillar_scores as Record<string, number>) || {};
  const healthScore = latestScan?.health_score || 0;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "from-green-500/20 to-green-500/5";
    if (score >= 60) return "from-amber-500/20 to-amber-500/5";
    return "from-red-500/20 to-red-500/5";
  };

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">رقيم — الخبير التقني المقيم</h1>
          <p className="text-muted-foreground text-sm mt-1">
            فحص شامل للمنصة: البنية، سير العمل، الأداء، الأمان
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => runScan.mutate("full_scan")}
            disabled={runScan.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${runScan.isPending ? "animate-spin" : ""}`} />
            {runScan.isPending ? "جاري الفحص..." : "فحص شامل"}
          </Button>
        </div>
      </div>

      {/* Health Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* Overall Score */}
        <Card className={`md:col-span-2 bg-gradient-to-br ${getScoreBg(healthScore)} border-0`}>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">صحة النظام</p>
            <p className={`text-5xl font-bold ${getScoreColor(healthScore)}`}>
              {healthScore.toFixed(0)}%
            </p>
            {latestScan && (
              <p className="text-xs text-muted-foreground mt-3">
                آخر فحص: {new Date(latestScan.created_at).toLocaleString("ar-SA")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pillar Scores */}
        {Object.entries(PILLAR_MAP).map(([key, { label, icon: Icon, color }]) => {
          const score = pillarScores[key] ?? 100;
          return (
            <Card key={key} className="border-border/50">
              <CardContent className="p-4 text-center">
                <Icon className={`h-5 w-5 mx-auto mb-2 ${color}`} />
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold ${getScoreColor(score)}`}>{score.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {findings.filter((f: any) => f.pillar === key).length} نتيجة
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Stats */}
      {latestScan && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-red-500/5 border-red-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-red-500">{latestScan.critical_count || 0}</p>
              <p className="text-xs text-muted-foreground">حرج</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-500">{latestScan.warning_count || 0}</p>
              <p className="text-xs text-muted-foreground">تحذير</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-500">{latestScan.info_count || 0}</p>
              <p className="text-xs text-muted-foreground">معلومة</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-500">{latestScan.total_findings || 0}</p>
              <p className="text-xs text-muted-foreground">إجمالي</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/50 border-border/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{latestScan.duration_ms || 0}ms</p>
              <p className="text-xs text-muted-foreground">مدة الفحص</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Findings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">نتائج الفحص</CardTitle>
            <div className="flex gap-1 flex-wrap">
              <Button
                variant={filterPillar === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilterPillar("all")}
              >
                الكل ({findings.length})
              </Button>
              {Object.entries(PILLAR_MAP).map(([key, { label }]) => {
                const count = findings.filter((f: any) => f.pillar === key).length;
                if (count === 0) return null;
                return (
                  <Button
                    key={key}
                    variant={filterPillar === key ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setFilterPillar(key)}
                  >
                    {label} ({count})
                  </Button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(findingsLoading || scanLoading) && (
            <div className="text-center text-muted-foreground py-8">جاري التحميل...</div>
          )}

          {!findingsLoading && filteredFindings.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <p className="text-lg font-semibold text-foreground">لا توجد مشاكل مكتشفة</p>
              <p className="text-sm text-muted-foreground">
                {latestScan ? "النظام يعمل بشكل سليم" : "اضغط \"فحص شامل\" لبدء أول فحص"}
              </p>
            </div>
          )}

          {filteredFindings.map((finding: any) => {
            const sev = SEVERITY_MAP[finding.severity] || SEVERITY_MAP.info;
            const pillar = PILLAR_MAP[finding.pillar];
            const isExpanded = expandedFinding === finding.id;
            const PillarIcon = pillar?.icon || Activity;
            const SevIcon = sev.icon;

            return (
              <div
                key={finding.id}
                className={`rounded-lg border p-4 transition-all ${sev.bg} ${
                  finding.status === "fixed" ? "opacity-50" : ""
                } ${finding.status === "ignored" ? "opacity-40" : ""}`}
              >
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setExpandedFinding(isExpanded ? null : finding.id)}
                >
                  <SevIcon className={`h-5 w-5 mt-0.5 shrink-0 ${sev.text}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs gap-1">
                        <PillarIcon className="h-3 w-3" />
                        {pillar?.label}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${sev.text}`}>
                        {sev.label}
                      </Badge>
                      {finding.difficulty && (
                        <Badge variant="outline" className="text-xs">
                          {finding.difficulty === "easy" ? "سهل" : finding.difficulty === "medium" ? "متوسط" : "صعب"}
                        </Badge>
                      )}
                      {finding.status !== "open" && (
                        <Badge variant={finding.status === "fixed" ? "default" : "secondary"} className="text-xs">
                          {finding.status === "fixed" ? "✅ تم الإصلاح" : finding.status === "ignored" ? "تم التجاهل" : "تم الاطلاع"}
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-semibold text-sm mt-1.5 text-foreground">{finding.title_ar}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{finding.description_ar}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-border/50 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1">الوصف الكامل:</p>
                      <p className="text-sm text-muted-foreground">{finding.description_ar}</p>
                    </div>
                    {finding.fix_suggestion_ar && (
                      <div className="bg-background/80 rounded-md p-3">
                        <p className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1">
                          <Wrench className="h-3 w-3" /> مقترح الإصلاح:
                        </p>
                        <p className="text-sm text-muted-foreground">{finding.fix_suggestion_ar}</p>
                      </div>
                    )}
                    {finding.status === "open" && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={(e) => { e.stopPropagation(); updateFinding.mutate({ id: finding.id, status: "acknowledged" }); }}
                        >
                          <Eye className="h-3 w-3" /> تم الاطلاع
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs text-green-600"
                          onClick={(e) => { e.stopPropagation(); updateFinding.mutate({ id: finding.id, status: "fixed" }); }}
                        >
                          <CheckCircle className="h-3 w-3" /> تم الإصلاح
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs text-muted-foreground"
                          onClick={(e) => { e.stopPropagation(); updateFinding.mutate({ id: finding.id, status: "ignored" }); }}
                        >
                          <EyeOff className="h-3 w-3" /> تجاهل
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Scan History */}
      <ScanHistory />
    </div>
  );
}

function ScanHistory() {
  const { data: scans = [] } = useQuery({
    queryKey: ["expert-scan-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("raqeem_expert_scans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  if (scans.length <= 1) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">سجل الفحوصات</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {scans.map((scan: any) => (
            <div key={scan.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm">
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold ${scan.health_score >= 80 ? "text-green-500" : scan.health_score >= 60 ? "text-amber-500" : "text-red-500"}`}>
                  {scan.health_score?.toFixed(0)}%
                </span>
                <span className="text-muted-foreground">
                  {new Date(scan.created_at).toLocaleString("ar-SA")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {scan.critical_count > 0 && <Badge variant="destructive" className="text-xs">{scan.critical_count} حرج</Badge>}
                {scan.warning_count > 0 && <Badge variant="outline" className="text-xs text-amber-500">{scan.warning_count} تحذير</Badge>}
                <span className="text-xs text-muted-foreground">{scan.duration_ms}ms</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
