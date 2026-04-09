import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import RaqeemIcon from "@/components/ui/RaqeemIcon";
import {
  Loader2, RefreshCw, Shield, Scale, DollarSign,
  Activity, Users, Zap, CheckCircle2, Eye, EyeOff, Clock,
  TrendingUp, ChevronDown, ChevronUp,
} from "lucide-react";

interface WatchdogFinding {
  id: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  recommendation: string;
  details: Record<string, unknown>;
  fingerprint: string;
  first_detected_at: string;
  last_detected_at: string;
  detection_count: number;
  auto_resolved: boolean;
  related_entity_type?: string;
  related_entity_id?: string;
}

interface ScanResult {
  id: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  findings_created: number;
  findings_updated: number;
  findings_auto_resolved: number;
  errors: string[];
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  technical: { label: "تقني", icon: Zap, color: "text-blue-500" },
  security: { label: "أمني", icon: Shield, color: "text-red-500" },
  workflow: { label: "إجرائي", icon: Activity, color: "text-orange-500" },
  legal: { label: "قانوني", icon: Scale, color: "text-purple-500" },
  financial: { label: "مالي", icon: DollarSign, color: "text-emerald-500" },
  user_behavior: { label: "سلوك المستخدمين", icon: Users, color: "text-cyan-500" },
  performance: { label: "أداء", icon: TrendingUp, color: "text-amber-500" },
};

const SEVERITY_CONFIG: Record<string, { label: string; variant: "destructive" | "default" | "secondary" | "outline"; bg: string }> = {
  critical: { label: "حرج", variant: "destructive", bg: "bg-red-500/10 border-red-500/30" },
  high: { label: "عالي", variant: "destructive", bg: "bg-orange-500/10 border-orange-500/30" },
  medium: { label: "متوسط", variant: "default", bg: "bg-yellow-500/10 border-yellow-500/30" },
  low: { label: "منخفض", variant: "secondary", bg: "bg-blue-500/10 border-blue-500/30" },
  info: { label: "معلومات", variant: "outline", bg: "bg-muted/50 border-border" },
};

export default function RaqeemWatchdogPage() {
  const { toast } = useToast();
  const [findings, setFindings] = useState<WatchdogFinding[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [severityStats, setSeverityStats] = useState<Record<string, number>>({});
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchFindings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("raqeem-watchdog", {
        body: { action: "get_findings" },
      });
      if (error) throw error;
      setFindings(data.findings || []);
      setStats(data.stats || {});
      setSeverityStats(data.severity_stats || {});
      setLastScan(data.last_scan || null);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchFindings(); }, [fetchFindings]);

  const runScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("raqeem-watchdog", {
        body: { action: "full_scan" },
      });
      if (error) throw error;
      toast({
        title: "اكتمل الفحص",
        description: `${data.findings?.total || 0} ملاحظة — ${data.findings?.created || 0} جديدة، ${data.findings?.auto_resolved || 0} محلولة تلقائياً`,
      });
      await fetchFindings();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const updateStatus = async (findingId: string, status: string) => {
    try {
      await supabase.functions.invoke("raqeem-watchdog", {
        body: { action: "update_finding", finding_id: findingId, status },
      });
      setFindings(prev => prev.map(f => f.id === findingId ? { ...f, status } : f));
      toast({ title: "تم التحديث" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const filteredFindings = activeTab === "all"
    ? findings
    : findings.filter(f => f.category === activeTab);

  const totalFindings = findings.length;
  const criticalCount = severityStats.critical || 0;
  const highCount = severityStats.high || 0;

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <RaqeemIcon size={32} />
          <div>
            <h1 className="text-2xl font-light text-foreground">رقيم — المراقب الشامل</h1>
            <p className="text-sm text-muted-foreground">
              فحص مستمر لـ 7 طبقات: تقني، أمني، إجرائي، قانوني، مالي، سلوكي، أداء
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastScan && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              آخر فحص: {new Date(lastScan.completed_at || lastScan.started_at).toLocaleString("ar-SA")}
              {lastScan.duration_ms && ` (${(lastScan.duration_ms / 1000).toFixed(1)}s)`}
            </span>
          )}
          <Button onClick={runScan} disabled={scanning} size="sm" className="gap-2">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            فحص شامل
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className={`cursor-pointer transition-colors ${activeTab === "all" ? "ring-2 ring-primary" : ""}`} onClick={() => setActiveTab("all")}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{totalFindings}</div>
            <div className="text-[10px] text-muted-foreground">إجمالي</div>
          </CardContent>
        </Card>
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          const count = stats[key] || 0;
          return (
            <Card key={key} className={`cursor-pointer transition-colors ${activeTab === key ? "ring-2 ring-primary" : ""}`} onClick={() => setActiveTab(key)}>
              <CardContent className="p-3 text-center">
                <Icon className={`w-4 h-4 mx-auto mb-1 ${config.color}`} />
                <div className="text-xl font-bold">{count}</div>
                <div className="text-[10px] text-muted-foreground">{config.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Severity bar */}
      {totalFindings > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">الخطورة:</span>
          {criticalCount > 0 && <Badge variant="destructive" className="text-[10px]">حرج: {criticalCount}</Badge>}
          {highCount > 0 && <Badge variant="destructive" className="text-[10px] bg-orange-500">عالي: {highCount}</Badge>}
          {(severityStats.medium || 0) > 0 && <Badge className="text-[10px] bg-yellow-500 text-black">متوسط: {severityStats.medium}</Badge>}
          {(severityStats.low || 0) > 0 && <Badge variant="secondary" className="text-[10px]">منخفض: {severityStats.low}</Badge>}
          {(severityStats.info || 0) > 0 && <Badge variant="outline" className="text-[10px]">معلومات: {severityStats.info}</Badge>}
        </div>
      )}

      {/* Findings List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredFindings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-3" />
            <p className="text-lg font-medium text-foreground">لا توجد ملاحظات مفتوحة</p>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === "all" ? "النظام يعمل بشكل سليم" : `لا توجد ملاحظات في فئة "${CATEGORY_CONFIG[activeTab]?.label}"`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="space-y-3">
            {filteredFindings.map(finding => {
              const catConfig = CATEGORY_CONFIG[finding.category];
              const sevConfig = SEVERITY_CONFIG[finding.severity];
              const CatIcon = catConfig?.icon || Activity;
              const isExpanded = expandedId === finding.id;

              return (
                <Card key={finding.id} className={`border ${sevConfig?.bg || ""} transition-all`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <CatIcon className={`w-5 h-5 mt-0.5 shrink-0 ${catConfig?.color || ""}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant={sevConfig?.variant || "default"} className="text-[10px]">
                              {sevConfig?.label}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">{catConfig?.label}</Badge>
                            {finding.detection_count > 1 && (
                              <span className="text-[10px] text-muted-foreground">
                                تكرر {finding.detection_count} مرة
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-medium text-foreground">{finding.title}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{finding.description}</p>

                          {isExpanded && (
                            <div className="mt-3 space-y-2">
                              {finding.recommendation && (
                                <div className="p-2 bg-primary/5 rounded-md border border-primary/20">
                                  <div className="flex items-center gap-1 mb-1">
                                    <RaqeemIcon size={12} />
                                    <span className="text-[10px] font-medium text-primary">اقتراح رقيم</span>
                                  </div>
                                  <p className="text-xs text-foreground">{finding.recommendation}</p>
                                </div>
                              )}
                              {finding.details && Object.keys(finding.details).length > 0 && (
                                <div className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded font-mono overflow-x-auto" dir="ltr">
                                  {JSON.stringify(finding.details, null, 2)}
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span>أول اكتشاف: {new Date(finding.first_detected_at).toLocaleString("ar-SA")}</span>
                                <span>|</span>
                                <span>آخر اكتشاف: {new Date(finding.last_detected_at).toLocaleString("ar-SA")}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpandedId(isExpanded ? null : finding.id)}>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                        {finding.status === "open" && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="تم الاطلاع" onClick={() => updateStatus(finding.id, "acknowledged")}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="تجاهل" onClick={() => updateStatus(finding.id, "ignored")}>
                              <EyeOff className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" title="تم الحل" onClick={() => updateStatus(finding.id, "resolved")}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        {finding.status === "acknowledged" && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" title="تم الحل" onClick={() => updateStatus(finding.id, "resolved")}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
