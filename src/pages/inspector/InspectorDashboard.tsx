import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin, Clock, CheckCircle, Calendar, Loader2, Building2, Play, Eye, LogOut,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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
  const [inspections, setInspections] = useState<InspectionTask[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
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
      const assignmentMap = new Map((assignments || []).map(a => [a.id, a]));
      tasks.forEach(t => { (t as any).assignment = assignmentMap.get(t.assignment_id); });
    }

    setInspections(tasks as InspectionTask[]);
    setProfile(profileRes.data);
    setLoading(false);
  };

  const startInspection = async (id: string) => {
    await supabase.from("inspections").update({
      status: "in_progress",
      started_at: new Date().toISOString(),
    }).eq("id", id);
    toast.success("تم بدء المعاينة");
    navigate(`/inspector/inspection/${id}`);
  };

  const active = inspections.filter(i => i.status === "assigned" || i.status === "in_progress");
  const done = inspections.filter(i => i.status === "submitted" || i.status === "reviewed" || i.completed);

  const stats = {
    total: inspections.length,
    active: active.length,
    done: done.length,
    todayCount: inspections.filter(i => i.inspection_date === format(new Date(), "yyyy-MM-dd")).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            لوحة المعاينات
          </h1>
          <p className="text-xs text-muted-foreground">المعاينات المسندة إليك</p>
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
          <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate("/client/login"); }}>
            <LogOut className="w-4 h-4 ml-1" />
            خروج
          </Button>
        </div>
      </div>

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

        <TabsContent value="done" className="mt-3 space-y-3">
          {done.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">لا توجد معاينات مكتملة</CardContent></Card>
          ) : done.map(insp => (
            <InspectionCard key={insp.id} inspection={insp} />
          ))}
        </TabsContent>
      </Tabs>
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

  return (
    <Card className="border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm font-medium" dir="ltr">{ref}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]">{PROPERTY_LABELS[propType] || propType}</Badge>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
            </div>
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
