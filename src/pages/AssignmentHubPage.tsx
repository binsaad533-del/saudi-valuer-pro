import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/utils";
import {
  MapPin, User, Building2, DollarSign, Clock, Camera,
  FileText, CheckCircle2, AlertTriangle, ChevronLeft, Loader2,
  ClipboardCheck, Scale, Shield, Sparkles, ExternalLink,
} from "lucide-react";
import RaqeemContextCard from "@/components/raqeem/RaqeemContextCard";
import ComparableSelectionEngine from "@/components/valuation/ComparableSelectionEngine";
import JustificationWriter from "@/components/valuation/JustificationWriter";
import type { RiskContext } from "@/lib/risk-detection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { SAR, SARIcon } from "@/components/ui/saudi-riyal";

interface StageInfo {
  key: string;
  label: string;
  icon: React.ReactNode;
  status: "done" | "active" | "pending" | "error";
  detail?: string;
  actionLabel?: string;
  actionUrl?: string;
}

const STATUS_COLORS = {
  done: "bg-green-500",
  active: "bg-primary animate-pulse",
  pending: "bg-muted-foreground/30",
  error: "bg-destructive",
};

export default function AssignmentHubPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<any>(null);
  const [request, setRequest] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [subject, setSubject] = useState<any>(null);
  const [inspection, setInspection] = useState<any>(null);
  const [comparables, setComparables] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [complianceChecks, setComplianceChecks] = useState<any[]>([]);
  const [slaStatus, setSlaStatus] = useState<{ onTrack: boolean; daysLeft: number; progress: number }>({ onTrack: true, daysLeft: 0, progress: 0 });

  useEffect(() => {
    if (!id) return;
    loadAssignmentData();
  }, [id]);

  const loadAssignmentData = async () => {
    setLoading(true);
    try {
      // Fetch assignment
      const { data: asgn } = await supabase
        .from("valuation_assignments")
        .select("*")
        .eq("id", id)
        .single();
      
      if (!asgn) {
        toast.error("لم يتم العثور على المهمة");
        navigate("/valuations");
        return;
      }
      setAssignment(asgn);

      // Calculate SLA
      const created = new Date(asgn.created_at);
      const totalDays = (asgn as any).sla_total_days || 10;
      const now = new Date();
      const elapsed = Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      const daysLeft = Math.max(0, totalDays - elapsed);
      const progress = Math.min(100, Math.round((elapsed / totalDays) * 100));
      setSlaStatus({ onTrack: daysLeft > 0, daysLeft, progress });

      // Fetch related data in parallel
      const requestId = (asgn as any).request_id;
      const [reqRes, subjRes, inspRes, compRes, checksRes] = await Promise.all([
        requestId ? supabase.from("valuation_requests").select("*").eq("id", requestId).single() : { data: null },
        supabase.from("subjects").select("*").eq("assignment_id", id!).limit(1).single(),
        supabase.from("inspections").select("*").eq("assignment_id", id!).order("created_at", { ascending: false }).limit(1).single(),
        supabase.from("assignment_comparables").select("*, comparables(*)").eq("assignment_id", id!),
        supabase.from("compliance_checks").select("*").eq("assignment_id", id!),
      ]);

      setRequest(reqRes.data);
      setSubject(subjRes.data);
      setInspection(inspRes.data);
      setComparables(compRes.data || []);
      setComplianceChecks(checksRes.data || []);

      // Fetch client
      if (reqRes.data?.client_id) {
        const { data: cl } = await supabase.from("clients").select("*").eq("id", reqRes.data.client_id).single();
        setClient(cl);
      }

      // Fetch photos
      if (inspRes.data?.id) {
        const { data: ph } = await supabase.from("inspection_photos").select("id").eq("inspection_id", inspRes.data.id);
        setPhotos(ph || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStages = (): StageInfo[] => {
    if (!assignment) return [];
    const status = assignment.status || "";
    const hasInspection = !!inspection;
    const inspectionDone = inspection?.completed || inspection?.status === "completed";
    const _hasComparables = comparables.length >= 3;
    const hasValue = !!assignment.final_value;
    const reportStatus = assignment.report_status || "";

    return [
      {
        key: "scope",
        label: "نطاق العمل",
        icon: <ClipboardCheck className="w-4 h-4" />,
        status: assignment.methodology ? "done" : status === "pending" ? "active" : "pending",
        detail: assignment.methodology || "لم يُحدد بعد",
        actionLabel: "توليد النطاق",
        actionUrl: `/ai-scope-pricing`,
      },
      {
        key: "inspection",
        label: "المعاينة الميدانية",
        icon: <Camera className="w-4 h-4" />,
        status: inspectionDone ? "done" : hasInspection ? "active" : "pending",
        detail: inspectionDone ? `مكتملة — ${photos.length} صورة` : hasInspection ? "قيد التنفيذ" : "لم تبدأ",
        actionUrl: hasInspection ? `/field-inspection` : undefined,
      },
      {
        key: "valuation",
        label: "التقييم والتحليل",
        icon: <Scale className="w-4 h-4" />,
        status: hasValue ? "done" : inspectionDone ? "active" : "pending",
        detail: hasValue ? `${formatNumber(assignment.final_value)} ر.س` : `${comparables.length} مقارنات`,
        actionUrl: `/valuation-production/${id}`,
      },
      {
        key: "report",
        label: "إعداد التقرير",
        icon: <FileText className="w-4 h-4" />,
        status: ["approved", "issued", "delivered"].includes(reportStatus) ? "done" : reportStatus === "draft" || reportStatus === "review" ? "active" : "pending",
        detail: reportStatus === "draft" ? "مسودة" : reportStatus === "review" ? "قيد المراجعة" : reportStatus === "approved" ? "معتمد" : "لم يُنشأ",
        actionUrl: `/reports/generate/${id}`,
      },
      {
        key: "compliance",
        label: "فحص الامتثال",
        icon: <Shield className="w-4 h-4" />,
        status: complianceChecks.length > 0 && complianceChecks.every((c: any) => c.is_passed) ? "done" : complianceChecks.some((c: any) => !c.is_passed) ? "error" : "pending",
        detail: complianceChecks.length > 0 ? `${complianceChecks.filter((c: any) => c.is_passed).length}/${complianceChecks.length} فحص ناجح` : "لم يُفحص",
        actionUrl: `/compliance`,
      },
      {
        key: "delivery",
        label: "الاعتماد والتسليم",
        icon: <CheckCircle2 className="w-4 h-4" />,
        status: ["issued", "delivered"].includes(reportStatus) ? "done" : reportStatus === "approved" ? "active" : "pending",
        detail: reportStatus === "issued" ? "صادر" : reportStatus === "delivered" ? "تم التسليم" : "في الانتظار",
      },
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!assignment) return null;

  const stages = getStages();
  const doneStages = stages.filter(s => s.status === "done").length;
  const overallProgress = Math.round((doneStages / stages.length) * 100);

  return (
    <div className="space-y-6 pb-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/valuations")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {assignment.reference_number || `مهمة #${id?.slice(0, 8)}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {subject?.property_type || "تقييم عقاري"} — {subject?.city_ar || client?.city_ar || ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/raqeem">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> رقيم
            </Button>
          </Link>
        </div>
      </div>

      {/* SLA Progress Bar */}
      <Card className="border-border">
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">تتبع SLA</span>
            </div>
            <Badge variant={slaStatus.onTrack ? "default" : "destructive"} className="text-xs">
              {slaStatus.onTrack ? `${slaStatus.daysLeft} يوم متبقي` : "تجاوز المدة!"}
            </Badge>
          </div>
          <Progress value={slaStatus.progress} className="h-2" />
          <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
            <span>الإنجاز: {overallProgress}% ({doneStages}/{stages.length} مراحل)</span>
            <span>{(assignment as any).sla_total_days || 10} يوم إجمالي</span>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stages */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stages.map((stage, i) => (
          <Card
            key={stage.key}
            className={`border cursor-pointer transition-all hover:shadow-md ${
              stage.status === "active" ? "border-primary ring-1 ring-primary/20" :
              stage.status === "error" ? "border-destructive/50" :
              stage.status === "done" ? "border-green-500/30" : "border-border"
            }`}
            onClick={() => stage.actionUrl && navigate(stage.actionUrl)}
          >
            <CardContent className="p-3 text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[stage.status]}`} />
                <span className="text-xs font-medium text-foreground">{i + 1}</span>
              </div>
              <div className="flex justify-center text-muted-foreground">{stage.icon}</div>
              <p className="text-xs font-semibold text-foreground leading-tight">{stage.label}</p>
              <p className="text-[10px] text-muted-foreground leading-snug">{stage.detail}</p>
              {stage.actionUrl && stage.status !== "done" && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary gap-0.5 p-0">
                  <ExternalLink className="w-2.5 h-2.5" /> انتقال
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Client Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> العميل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-medium">{client?.name_ar || request?.client_name || "—"}</p>
            {client?.phone && <p className="text-muted-foreground">{client.phone}</p>}
            {client?.email && <p className="text-muted-foreground">{client.email}</p>}
            {client?.id_number && <p className="text-muted-foreground">هوية: {client.id_number}</p>}
          </CardContent>
        </Card>

        {/* Property Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> العقار
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-medium">{subject?.property_type || "—"}</p>
            <div className="flex items-start gap-1 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{subject?.address_ar || subject?.city_ar || "—"}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              {subject?.land_area && <span>أرض: {formatNumber(subject.land_area)} م²</span>}
              {subject?.building_area && <span>بناء: {formatNumber(subject.building_area)} م²</span>}
            </div>
          </CardContent>
        </Card>

        {/* Valuation Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <SARIcon className="w-4 h-4 text-primary" /> التقييم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-medium text-lg">
              {assignment.final_value ? <span className="inline-flex items-center gap-1">{formatNumber(assignment.final_value)} <SAR size={14} /></span> : "لم يُحدد"}
            </p>
            <p className="text-muted-foreground">المنهجية: {assignment.methodology || "—"}</p>
            <p className="text-muted-foreground">الغرض: {assignment.purpose_ar || "—"}</p>
            <p className="text-muted-foreground">المقارنات: {comparables.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Comparable Selection Engine */}
      <ComparableSelectionEngine
        assignmentId={id!}
        subjectCity={subject?.city_ar}
        subjectDistrict={subject?.district_ar}
        subjectPropertyType={subject?.property_type}
        subjectArea={subject?.land_area}
        onResultReady={() => loadAssignmentData()}
      />

      {/* Justification Engine */}
      <JustificationWriter
        context={{
          methodsUsed: assignment?.methodology ? [assignment.methodology] : [],
          hasAssumptions: true,
          dataQuality: comparables.length >= 3 ? "sufficient" : "limited",
        } as RiskContext}
        asset={(subject ?? {}) as Record<string, unknown>}
        valuation={{
          finalValue: assignment?.final_value,
          methodology: assignment?.methodology,
          purpose: assignment?.purpose_ar,
        }}
        confidenceScore={75}
        confidenceLevel="متوسط"
        compliancePassed={complianceChecks.every((c: any) => c.is_passed)}
        comparables={comparables as Record<string, unknown>[]}
        finalValue={{
          amount: assignment?.final_value,
          currency: "SAR",
          methodology: assignment?.methodology,
        }}
      />

      {/* Compliance Summary */}
      {complianceChecks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> فحوصات الامتثال
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {complianceChecks.map((check: any) => (
                <div
                  key={check.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                    check.is_passed ? "border-green-500/20 bg-green-500/5" : "border-destructive/20 bg-destructive/5"
                  }`}
                >
                  {check.is_passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  )}
                  <span>{check.check_name_ar}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">الإجراءات السريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link to="/raqeem">
              <Button size="sm" className="gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5" /> طلب من ChatGPT
              </Button>
            </Link>
            <Link to={`/reports/generate/${id}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <FileText className="w-3.5 h-3.5" /> توليد التقرير
              </Button>
            </Link>
            <Link to={`/valuation-production/${id}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Scale className="w-3.5 h-3.5" /> إنتاج التقييم
              </Button>
            </Link>
            <Link to="/compliance">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Shield className="w-3.5 h-3.5" /> فحص الامتثال
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Raqeem Agent Card */}
      {id && (
        <RaqeemContextCard
          assignmentId={id}
          pageContext="لوحة تتبع المهمة - Assignment Hub"
          className="mt-4"
        />
      )}
    </div>
  );
}
