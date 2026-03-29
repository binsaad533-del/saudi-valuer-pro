import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin, Clock, CheckCircle, Calendar, Loader2, Building2, Play, Eye, LogOut,
  User, AlertCircle, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

interface InspectionTask {
  id: string;
  assignment_id: string;
  inspection_date: string;
  inspection_time: string | null;
  type: string | null;
  completed: boolean | null;
  status: string;
  notes_ar: string | null;
  findings_ar: string | null;
  started_at: string | null;
  submitted_at: string | null;
  created_at: string;
  assignment?: {
    reference_number: string;
    status: string;
    property_type: string;
    subjects?: Array<{
      city_ar: string | null;
      district_ar: string | null;
    }>;
  };
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  assigned: { label: "مُسندة", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  in_progress: { label: "جارية", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  submitted: { label: "مُرسلة", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  reviewed: { label: "مُراجعة", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
};

export default function InspectorDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inspections, setInspections] = useState<InspectionTask[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [userName, setUserName] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/client/login");
      return;
    }

    // Get user profile name
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("full_name_ar")
      .eq("user_id", user.id)
      .maybeSingle();
    setUserName(userProfile?.full_name_ar || user.user_metadata?.full_name || "معاين");

    const [inspRes, profileRes] = await Promise.all([
      supabase.from("inspections").select("*").eq("inspector_id", user.id).order("inspection_date", { ascending: false }),
      supabase.from("inspector_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    const tasks = inspRes.data || [];
    if (tasks.length > 0) {
      const assignmentIds = [...new Set(tasks.map(t => t.assignment_id))];
      const { data: assignments } = await supabase
        .from("valuation_assignments")
        .select("id, reference_number, status, property_type")
        .in("id", assignmentIds);

      // Also fetch subject locations for each assignment
      const { data: subjects } = await supabase
        .from("subjects" as any)
        .select("assignment_id, city_ar, district_ar")
        .in("assignment_id", assignmentIds);

      const assignmentMap = new Map((assignments || []).map(a => [a.id, { ...a, subjects: [] as any[] }]));

      // Attach subjects to assignments
      (subjects || []).forEach((s: any) => {
        const asg = assignmentMap.get(s.assignment_id);
        if (asg) asg.subjects.push(s);
      });

      tasks.forEach(t => { (t as any).assignment = assignmentMap.get(t.assignment_id); });
    }

    setInspections(tasks as InspectionTask[]);
    setProfile(profileRes.data);
    setLoading(false);
    setRefreshing(false);
    if (isRefresh) toast.success("تم تحديث البيانات");
  };

  const startInspection = async (id: string) => {
    await supabase.from("inspections").update({
      status: "in_progress",
      started_at: new Date().toISOString(),
    }).eq("id", id);
    toast.success("تم بدء المعاينة");
    navigate(`/inspector/inspection/${id}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/client/login");
  };

  const active = inspections.filter(i => i.status === "assigned" || i.status === "in_progress");
  const done = inspections.filter(i => i.status === "submitted" || i.status === "reviewed" || i.completed);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayInspections = inspections.filter(i => i.inspection_date === todayStr);
  const urgentCount = active.filter(i => {
    const inspDate = new Date(i.inspection_date);
    const today = new Date();
    today.setHours(0,0,0,0);
    return inspDate <= today && i.status === "assigned";
  }).length;

  const stats = {
    total: inspections.length,
    active: active.length,
    done: done.length,
    todayCount: todayInspections.length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Top Bar */}
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="جساس" className="w-8 h-8" />
            <div>
              <h2 className="text-sm font-bold text-foreground">بوابة المعاينات</h2>
              <p className="text-xs text-muted-foreground">جساس للتقييم</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile && (
              <Badge className={profile.availability_status === "available"
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-muted text-muted-foreground"
              }>
                {profile.availability_status === "available" ? "متاح" : profile.availability_status === "busy" ? "مشغول" : "غير متاح"}
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 ml-1" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-base font-bold text-foreground">أهلاً، {userName}</h1>
              <p className="text-xs text-muted-foreground">المعاينات المسندة إليك</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ml-1 ${refreshing ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>

        {/* Urgent alert */}
        {urgentCount > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">
              لديك {urgentCount} معاينة متأخرة تحتاج إجراءك الفوري
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { n: stats.total, l: "الكل", c: "text-foreground" },
            { n: stats.active, l: "نشطة", c: "text-yellow-600" },
            { n: stats.done, l: "مكتملة", c: "text-green-600" },
            { n: stats.todayCount, l: "اليوم", c: "text-primary" },
          ].map(s => (
            <Card key={s.l}>
              <CardContent className="p-3 text-center">
                <p className={`text-xl font-bold ${s.c}`}>{s.n}</p>
                <p className="text-[10px] text-muted-foreground">{s.l}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="active" dir="rtl">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1 gap-1 text-xs">
              <Clock className="w-3.5 h-3.5" /> نشطة ({active.length})
            </TabsTrigger>
            <TabsTrigger value="today" className="flex-1 gap-1 text-xs">
              <Calendar className="w-3.5 h-3.5" /> اليوم ({todayInspections.length})
            </TabsTrigger>
            <TabsTrigger value="done" className="flex-1 gap-1 text-xs">
              <CheckCircle className="w-3.5 h-3.5" /> مكتملة ({done.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-3 space-y-3">
            {active.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">لا توجد معاينات نشطة</CardContent></Card>
            ) : active.map(insp => (
              <InspectionCard key={insp.id} inspection={insp} onStart={startInspection} onResume={(id) => navigate(`/inspector/inspection/${id}`)} />
            ))}
          </TabsContent>

          <TabsContent value="today" className="mt-3 space-y-3">
            {todayInspections.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">لا توجد معاينات مجدولة اليوم</CardContent></Card>
            ) : todayInspections.map(insp => (
              <InspectionCard key={insp.id} inspection={insp} onStart={startInspection} onResume={(id) => navigate(`/inspector/inspection/${id}`)} />
            ))}
          </TabsContent>

          <TabsContent value="done" className="mt-3 space-y-3">
            {done.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">لا توجد معاينات مكتملة</CardContent></Card>
            ) : done.map(insp => (
              <InspectionCard key={insp.id} inspection={insp} />
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

const PROPERTY_LABELS: Record<string, string> = {
  residential_land: "أرض سكنية", commercial_land: "أرض تجارية",
  residential_building: "مبنى سكني", commercial_building: "مبنى تجاري",
  villa: "فيلا", apartment: "شقة", office: "مكتب",
  warehouse: "مستودع", farm: "مزرعة", mixed_use: "متعدد الاستخدامات",
};

function InspectionCard({ inspection, onStart, onResume }: {
  inspection: InspectionTask;
  onStart?: (id: string) => void;
  onResume?: (id: string) => void;
}) {
  const ref = inspection.assignment?.reference_number || "—";
  const propType = inspection.assignment?.property_type || "";
  const st = STATUS_MAP[inspection.status] || STATUS_MAP.assigned;
  const subject = inspection.assignment?.subjects?.[0];
  const locationText = [subject?.district_ar, subject?.city_ar].filter(Boolean).join("، ");

  // Check if overdue
  const isOverdue = (() => {
    if (inspection.status !== "assigned") return false;
    const inspDate = new Date(inspection.inspection_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return inspDate < today;
  })();

  return (
    <Card className={`border ${isOverdue ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm font-medium" dir="ltr">{ref}</span>
              {isOverdue && (
                <Badge variant="destructive" className="text-[10px]">متأخرة</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]">{PROPERTY_LABELS[propType] || propType}</Badge>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
            </div>
            {locationText && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>{locationText}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {inspection.inspection_date}
              </span>
              {inspection.inspection_time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {inspection.inspection_time}
                </span>
              )}
            </div>
          </div>
          {inspection.type && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {inspection.type === "internal_external" ? "داخلي + خارجي" : inspection.type === "external_only" ? "خارجي فقط" : inspection.type}
            </Badge>
          )}
        </div>

        {/* Actions */}
        {inspection.status === "assigned" && onStart && (
          <Button onClick={() => onStart(inspection.id)} className="w-full h-12 text-base">
            <Play className="w-5 h-5 ml-2" /> بدء المعاينة
          </Button>
        )}
        {inspection.status === "in_progress" && onResume && (
          <Button onClick={() => onResume(inspection.id)} variant="outline" className="w-full h-12 text-base">
            <Eye className="w-5 h-5 ml-2" /> متابعة المعاينة
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
