import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  MapPin, Clock, CheckCircle, AlertTriangle, Camera, FileText,
  Calendar, User, Loader2, Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface InspectionTask {
  id: string;
  assignment_id: string;
  inspection_date: string;
  inspection_time: string | null;
  type: string | null;
  completed: boolean | null;
  notes_ar: string | null;
  findings_ar: string | null;
  created_at: string;
  assignment?: {
    reference_number: string;
    status: string;
    property_type: string;
  };
}

export default function InspectorDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<InspectionTask[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const [inspRes, profileRes] = await Promise.all([
      supabase
        .from("inspections")
        .select("*")
        .eq("inspector_id", user.id)
        .order("inspection_date", { ascending: false }),
      supabase
        .from("inspector_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    // Enrich inspections with assignment data
    const tasks = inspRes.data || [];
    if (tasks.length > 0) {
      const assignmentIds = [...new Set(tasks.map(t => t.assignment_id))];
      const { data: assignments } = await supabase
        .from("valuation_assignments")
        .select("id, reference_number, status, property_type")
        .in("id", assignmentIds);

      const assignmentMap = new Map((assignments || []).map(a => [a.id, a]));
      tasks.forEach(t => {
        (t as any).assignment = assignmentMap.get(t.assignment_id);
      });
    }

    setInspections(tasks as InspectionTask[]);
    setProfile(profileRes.data);
    setLoading(false);
  };

  const pending = inspections.filter(i => !i.completed);
  const completed = inspections.filter(i => i.completed);

  const stats = {
    total: inspections.length,
    pending: pending.length,
    completed: completed.length,
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
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            لوحة المعاينات الميدانية
          </h1>
          <p className="text-sm text-muted-foreground">المعاينات المسندة إليك فقط</p>
        </div>
        {profile && (
          <Badge variant={profile.availability_status === "available" ? "default" : "secondary"}>
            {profile.availability_status === "available" ? "متاح" : profile.availability_status === "busy" ? "مشغول" : "غير متاح"}
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">إجمالي المعاينات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">قيد الانتظار</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-xs text-muted-foreground">مكتملة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.todayCount}</p>
            <p className="text-xs text-muted-foreground">اليوم</p>
          </CardContent>
        </Card>
      </div>

      {/* Profile info */}
      {profile && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              ملف المعاين
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <span className="text-muted-foreground">المدن:</span>
              {(profile.cities_ar || []).map((c: string) => (
                <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
              ))}
              {(profile.cities_ar || []).length === 0 && <span className="text-muted-foreground">غير محدد</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-muted-foreground">المناطق:</span>
              {(profile.regions_ar || []).map((r: string) => (
                <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">عبء العمل:</span>
              <span>{profile.current_workload} / {profile.max_concurrent_tasks}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="pending" dir="rtl">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="w-3.5 h-3.5" /> قيد الانتظار ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> مكتملة ({completed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pending.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">لا توجد معاينات قيد الانتظار</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {pending.map(insp => (
                <InspectionCard key={insp.id} inspection={insp} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completed.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">لا توجد معاينات مكتملة</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {completed.map(insp => (
                <InspectionCard key={insp.id} inspection={insp} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InspectionCard({ inspection }: { inspection: InspectionTask }) {
  const ref = inspection.assignment?.reference_number || "—";
  const propType = inspection.assignment?.property_type || "";

  const propertyTypeLabels: Record<string, string> = {
    residential_land: "أرض سكنية",
    commercial_land: "أرض تجارية",
    residential_building: "مبنى سكني",
    commercial_building: "مبنى تجاري",
    villa: "فيلا",
    apartment: "شقة",
    office: "مكتب",
    warehouse: "مستودع",
    farm: "مزرعة",
    mixed_use: "متعدد الاستخدامات",
  };

  return (
    <Card className={`border ${inspection.completed ? "border-green-200 dark:border-green-800" : "border-yellow-200 dark:border-yellow-800"}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm font-medium" dir="ltr">{ref}</span>
              <Badge variant="outline" className="text-[10px]">{propertyTypeLabels[propType] || propType}</Badge>
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
              <Badge variant={inspection.completed ? "default" : "secondary"} className="text-[10px]">
                {inspection.completed ? "مكتمل" : "قيد الانتظار"}
              </Badge>
            </div>
            {inspection.notes_ar && (
              <p className="text-xs text-muted-foreground mt-1">{inspection.notes_ar}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {inspection.type && (
              <Badge variant="outline" className="text-[10px]">
                {inspection.type === "internal_external" ? "داخلي + خارجي" : inspection.type === "external_only" ? "خارجي فقط" : inspection.type}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
