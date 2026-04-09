import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import RaqeemIcon from "@/components/ui/RaqeemIcon";
import {
  Loader2, Shield, DollarSign, Activity, Zap, Database,
  TrendingUp, Heart, AlertTriangle, CheckCircle2, RefreshCw,
  Server, Code, BarChart3, Cpu,
} from "lucide-react";

interface TechFinding {
  id: string;
  severity: string;
  title: string;
  description?: string;
  recommendation?: string;
  category: string;
  metadata?: Record<string, unknown>;
}

interface ScanResults {
  health_score: number;
  health_status: string;
  total_findings: number;
  by_severity: Record<string, number>;
  security_summary?: any;
  automation_summary?: any;
  database_summary?: any;
  commerce_summary?: any;
  revenue_summary?: any;
  performance_summary?: any;
  scanned_at: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  security: { label: "الأمن السيبراني", icon: Shield, color: "text-red-500" },
  performance: { label: "الأداء", icon: Cpu, color: "text-blue-500" },
  automation: { label: "الأتمتة", icon: Zap, color: "text-amber-500" },
  commerce: { label: "التجارة", icon: DollarSign, color: "text-emerald-500" },
  code_quality: { label: "جودة الكود", icon: Code, color: "text-purple-500" },
  database: { label: "قاعدة البيانات", icon: Database, color: "text-cyan-500" },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-700 border-red-500/30",
  high: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  low: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  info: "bg-muted text-muted-foreground border-border",
};

const ACTIONS = [
  { key: "full_scan", label: "مسح شامل", icon: RefreshCw, description: "فحص جميع القدرات" },
  { key: "security_scan", label: "أمن سيبراني", icon: Shield, description: "جلسات + اختراق + RLS" },
  { key: "security_report", label: "تقرير أمني", icon: AlertTriangle, description: "ملخص أمني شامل" },
  { key: "auto_heal", label: "تعافي ذاتي", icon: Activity, description: "إصلاح العمليات المتعثرة" },
  { key: "performance_monitor", label: "مراقبة الأداء", icon: Server, description: "أداء النظام والتخزين" },
  { key: "db_health", label: "صحة قاعدة البيانات", icon: Database, description: "حجم الجداول والفهارس" },
  { key: "error_intelligence", label: "ذكاء الأخطاء", icon: Code, description: "تحليل الأخطاء المتكررة" },
  { key: "dynamic_pricing", label: "تسعير ديناميكي", icon: BarChart3, description: "تحليل واقتراحات الأسعار" },
  { key: "loyalty_engine", label: "محرك الولاء", icon: Heart, description: "تحليل سلوك العملاء" },
  { key: "revenue_forecast", label: "توقعات الإيرادات", icon: TrendingUp, description: "تنبؤ مالي ذكي" },
];

export default function RaqeemTechEnginePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);
  const [findings, setFindings] = useState<TechFinding[]>([]);
  const [actionResults, setActionResults] = useState<any>(null);

  const runAction = useCallback(async (action: string) => {
    setLoading(true);
    setActiveAction(action);
    try {
      const { data, error } = await supabase.functions.invoke("raqeem-tech-engine", {
        body: { action },
      });
      if (error) throw error;

      if (action === "full_scan") {
        setScanResults(data.results);
        // Load findings from DB
        const { data: dbFindings } = await supabase
          .from("raqeem_tech_findings" as any)
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(50);
        setFindings((dbFindings as any) || []);
      } else {
        setActionResults(data.results);
        // Refresh findings
        const { data: dbFindings } = await supabase
          .from("raqeem_tech_findings" as any)
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(50);
        setFindings((dbFindings as any) || []);
      }

      toast({ title: "اكتمل الفحص", description: `تم تنفيذ: ${ACTIONS.find(a => a.key === action)?.label}` });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  }, [toast]);

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RaqeemIcon size={32} />
          <div>
            <h1 className="text-xl font-bold text-foreground">المحرك التقني الشامل</h1>
            <p className="text-sm text-muted-foreground">15 قدرة ذكية — أمن سيبراني، أتمتة، أداء، تجارة</p>
          </div>
        </div>
      </div>

      {/* Health Score Card */}
      {scanResults && (
        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getHealthColor(scanResults.health_score)}`}>
                  {scanResults.health_score}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">{scanResults.health_status}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{scanResults.total_findings}</div>
                <div className="text-sm text-muted-foreground">إجمالي الاكتشافات</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{scanResults.by_severity?.critical || 0}</div>
                <div className="text-sm text-muted-foreground">حرج</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{scanResults.by_severity?.high || 0}</div>
                <div className="text-sm text-muted-foreground">عالي</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">{scanResults.by_severity?.medium || 0}</div>
                <div className="text-sm text-muted-foreground">متوسط</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="actions" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="actions">القدرات</TabsTrigger>
          <TabsTrigger value="findings">الاكتشافات ({findings.length})</TabsTrigger>
          <TabsTrigger value="results">النتائج</TabsTrigger>
        </TabsList>

        {/* Actions Grid */}
        <TabsContent value="actions">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              const isRunning = loading && activeAction === action.key;
              return (
                <Card key={action.key} className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer group"
                  onClick={() => !loading && runAction(action.key)}>
                  <CardContent className="p-4 flex flex-row-reverse items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      {isRunning ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Icon className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-foreground">{action.label}</div>
                      <div className="text-xs text-muted-foreground">{action.description}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Findings List */}
        <TabsContent value="findings">
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {findings.length === 0 ? (
                <Card className="border-border/50">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/50" />
                    <p>لا توجد اكتشافات — شغّل المسح الشامل أولاً</p>
                  </CardContent>
                </Card>
              ) : findings.map((finding) => {
                const cat = CATEGORY_CONFIG[finding.category] || { label: finding.category, icon: Zap, color: "text-muted-foreground" };
                const CatIcon = cat.icon;
                return (
                  <Card key={finding.id} className={`border ${SEVERITY_COLORS[finding.severity] || ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <CatIcon className={`h-5 w-5 mt-0.5 shrink-0 ${cat.color}`} />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{finding.title}</span>
                            <Badge variant="outline" className="text-[10px]">{cat.label}</Badge>
                            <Badge variant={finding.severity === "critical" ? "destructive" : "secondary"} className="text-[10px]">
                              {finding.severity}
                            </Badge>
                          </div>
                          {finding.description && (
                            <p className="text-xs text-muted-foreground">{finding.description}</p>
                          )}
                          {finding.recommendation && (
                            <p className="text-xs text-primary/80 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {finding.recommendation}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Raw Results */}
        <TabsContent value="results">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm">نتائج آخر عملية</CardTitle>
            </CardHeader>
            <CardContent>
              {actionResults || scanResults ? (
                <ScrollArea className="h-[400px]">
                  <pre className="text-xs font-mono bg-muted/50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap" dir="ltr">
                    {JSON.stringify(actionResults || scanResults, null, 2)}
                  </pre>
                </ScrollArea>
              ) : (
                <p className="text-center text-muted-foreground py-8">شغّل أي عملية لعرض النتائج</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
