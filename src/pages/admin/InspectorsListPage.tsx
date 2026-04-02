import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, RefreshCw, Loader2, MapPin, Star, Eye,
  ArrowUpDown, Award, TrendingUp, Users, CheckCircle2, Clock,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { formatDate } from "@/lib/utils";
import AddInspectorDialog from "@/components/inspectors/AddInspectorDialog";


interface InspectorRow {
  id: string;
  user_id: string;
  is_active: boolean;
  availability_status: string;
  quality_score: number | null;
  total_completed: number | null;
  current_workload: number | null;
  avg_response_hours: number | null;
  avg_completion_hours: number | null;
  cities_ar: string[] | null;
  regions_ar: string[] | null;
  specializations: string[] | null;
  inspector_category: string;
  overall_score: number;
  avg_rating: number;
  complaints_count: number;
  approved_count: number;
  rejected_count: number;
  // joined from profiles
  full_name_ar: string;
  email: string | null;
  phone: string | null;
  // computed
  assignedTasks: number;
  completedTasks: number;
  lastActivity: string | null;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  top_performer: { label: "أداء متميز", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200", icon: Award },
  excellent: { label: "ممتاز", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200", icon: TrendingUp },
  good: { label: "جيد", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200", icon: Star },
  needs_attention: { label: "يحتاج متابعة", color: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-200", icon: Clock },
  under_review: { label: "تحت المراجعة", color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200", icon: Eye },
};

type SortField = "name" | "rating" | "completed" | "response" | "complaints";

export default function InspectorsListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inspectors, setInspectors] = useState<InspectorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("rating");
  const [sortAsc, setSortAsc] = useState(false);

  const mockInspectors: InspectorRow[] = [
    { id: "m1", user_id: "u1", is_active: true, availability_status: "available", quality_score: 92, total_completed: 48, current_workload: 3, avg_response_hours: 1.5, avg_completion_hours: 3.2, cities_ar: ["الرياض", "الدرعية"], regions_ar: ["الرياض"], specializations: ["سكني", "تجاري"], inspector_category: "top_performer", overall_score: 95, avg_rating: 4.8, complaints_count: 0, approved_count: 46, rejected_count: 2, full_name_ar: "خالد العتيبي", email: "khalid@example.com", phone: "0551234567", assignedTasks: 51, completedTasks: 48, lastActivity: "2026-03-28" },
    { id: "m2", user_id: "u2", is_active: true, availability_status: "available", quality_score: 85, total_completed: 32, current_workload: 5, avg_response_hours: 2.1, avg_completion_hours: 4.0, cities_ar: ["جدة", "مكة المكرمة"], regions_ar: ["مكة المكرمة"], specializations: ["سكني", "أراضي"], inspector_category: "good", overall_score: 82, avg_rating: 4.5, complaints_count: 1, approved_count: 30, rejected_count: 2, full_name_ar: "عبدالله الغامدي", email: "abdullah@example.com", phone: "0559876543", assignedTasks: 35, completedTasks: 32, lastActivity: "2026-03-27" },
    { id: "m3", user_id: "u3", is_active: true, availability_status: "busy", quality_score: 78, total_completed: 21, current_workload: 6, avg_response_hours: 3.0, avg_completion_hours: 5.5, cities_ar: ["الدمام", "الخبر"], regions_ar: ["الشرقية"], specializations: ["صناعي", "آلات"], inspector_category: "good", overall_score: 75, avg_rating: 4.2, complaints_count: 2, approved_count: 19, rejected_count: 2, full_name_ar: "سعد الدوسري", email: "saad@example.com", phone: "0553334444", assignedTasks: 27, completedTasks: 21, lastActivity: "2026-03-29" },
    { id: "m4", user_id: "u4", is_active: false, availability_status: "unavailable", quality_score: 60, total_completed: 12, current_workload: 0, avg_response_hours: 5.0, avg_completion_hours: 8.0, cities_ar: ["المدينة المنورة"], regions_ar: ["المدينة المنورة"], specializations: ["سكني"], inspector_category: "needs_improvement", overall_score: 55, avg_rating: 3.5, complaints_count: 4, approved_count: 10, rejected_count: 2, full_name_ar: "فهد القحطاني", email: "fahad@example.com", phone: "0557778888", assignedTasks: 14, completedTasks: 12, lastActivity: "2026-03-10" },
    { id: "m5", user_id: "u5", is_active: true, availability_status: "available", quality_score: 88, total_completed: 55, current_workload: 2, avg_response_hours: 1.2, avg_completion_hours: 2.8, cities_ar: ["الرياض", "الخرج"], regions_ar: ["الرياض"], specializations: ["تجاري", "صناعي", "آلات ومعدات"], inspector_category: "top_performer", overall_score: 91, avg_rating: 4.9, complaints_count: 0, approved_count: 54, rejected_count: 1, full_name_ar: "محمد الشمري", email: "mohammed@example.com", phone: "0552223333", assignedTasks: 58, completedTasks: 55, lastActivity: "2026-03-29" },
  ];

  const fetchInspectors = async () => {
    setLoading(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000)
      );
      const query = supabase.from("inspector_profiles").select("*").limit(100);
      const { data: profiles, error: pErr } = await Promise.race([query, timeout]);

      if (pErr || !profiles || profiles.length === 0) {
        setInspectors(mockInspectors);
        setLoading(false);
        return;
      }

      const userIds = profiles.map((p) => p.user_id);

      const [profilesRes, inspectionsRes] = await Promise.race([
        Promise.all([
          supabase.from("profiles").select("user_id, full_name_ar, email, phone").in("user_id", userIds),
          supabase.from("inspections").select("inspector_id, status, created_at, completed").in("inspector_id", userIds),
        ]),
        timeout,
      ]);

      const profileMap: Record<string, any> = {};
      (profilesRes.data || []).forEach((p: any) => { profileMap[p.user_id] = p; });

      const inspectionsByUser: Record<string, any[]> = {};
      (inspectionsRes.data || []).forEach((i: any) => {
        if (!inspectionsByUser[i.inspector_id]) inspectionsByUser[i.inspector_id] = [];
        inspectionsByUser[i.inspector_id].push(i);
      });

      const combined: InspectorRow[] = profiles.map((ip) => {
        const prof = profileMap[ip.user_id] || {};
        const tasks = inspectionsByUser[ip.user_id] || [];
        const completed = tasks.filter((t: any) => t.status === "submitted" || t.status === "reviewed" || t.completed);
        const lastTask = [...tasks].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        return {
          ...ip,
          full_name_ar: prof.full_name_ar || "—",
          email: prof.email,
          phone: prof.phone,
          assignedTasks: tasks.length,
          completedTasks: completed.length,
          lastActivity: lastTask?.created_at || null,
          inspector_category: ip.inspector_category || "good",
          overall_score: ip.overall_score || 0,
          avg_rating: ip.avg_rating || 0,
          complaints_count: ip.complaints_count || 0,
          approved_count: ip.approved_count || 0,
          rejected_count: ip.rejected_count || 0,
        };
      });

      setInspectors(combined.length > 0 ? combined : mockInspectors);
    } catch {
      setInspectors(mockInspectors);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInspectors(); }, []);

  const filtered = useMemo(() => {
    let result = inspectors.filter((i) => {
      const matchSearch = !search || i.full_name_ar.includes(search) || (i.email || "").includes(search);
      const matchCategory = categoryFilter === "all" || i.inspector_category === categoryFilter;
      const matchStatus = statusFilter === "all" || (statusFilter === "active" ? i.is_active : !i.is_active);
      return matchSearch && matchCategory && matchStatus;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.full_name_ar.localeCompare(b.full_name_ar, "ar"); break;
        case "rating": cmp = a.avg_rating - b.avg_rating; break;
        case "completed": cmp = a.completedTasks - b.completedTasks; break;
        case "response": cmp = (a.avg_response_hours || 999) - (b.avg_response_hours || 999); break;
        case "complaints": cmp = a.complaints_count - b.complaints_count; break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [inspectors, search, categoryFilter, statusFilter, sortField, sortAsc]);

  const stats = useMemo(() => ({
    total: inspectors.length,
    active: inspectors.filter((i) => i.is_active).length,
    topPerformers: inspectors.filter((i) => i.inspector_category === "top_performer").length,
    totalCompleted: inspectors.reduce((s, i) => s + i.completedTasks, 0),
  }), [inspectors]);

  const CategoryBadge = ({ category }: { category: string }) => {
    const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.good;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة المعاينين</h1>
          <p className="text-sm text-muted-foreground mt-1">عرض وإدارة جميع المعاينين الميدانيين وأدائهم</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">إجمالي المعاينين</p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.active}</p>
              <p className="text-xs text-muted-foreground">نشطون حالياً</p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.topPerformers}</p>
              <p className="text-xs text-muted-foreground">أداء متميز</p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalCompleted}</p>
              <p className="text-xs text-muted-foreground">معاينات مكتملة</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو البريد..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="التصنيف" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع التصنيفات</SelectItem>
              <SelectItem value="top_performer">أداء متميز</SelectItem>
              <SelectItem value="excellent">ممتاز</SelectItem>
              <SelectItem value="good">جيد</SelectItem>
              <SelectItem value="needs_attention">يحتاج متابعة</SelectItem>
              <SelectItem value="under_review">تحت المراجعة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">موقوف</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortField} onValueChange={(v) => { setSortField(v as SortField); setSortAsc(false); }}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="ترتيب" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">التقييم</SelectItem>
              <SelectItem value="completed">المهام المكتملة</SelectItem>
              <SelectItem value="response">سرعة الاستجابة</SelectItem>
              <SelectItem value="complaints">أقل شكاوى</SelectItem>
              <SelectItem value="name">الاسم</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setSortAsc(!sortAsc)}>
            <ArrowUpDown className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={fetchInspectors} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">لا يوجد معاينون</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">المنطقة</TableHead>
                    <TableHead className="text-right">المهام المسندة</TableHead>
                    <TableHead className="text-right">المكتملة</TableHead>
                    <TableHead className="text-right">التقييم</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">آخر نشاط</TableHead>
                    <TableHead className="text-right">التصنيف</TableHead>
                    <TableHead className="text-right">عرض</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((insp) => (
                    <TableRow key={insp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/inspectors/${insp.user_id}`)}>
                      <TableCell className="font-medium">{insp.full_name_ar}</TableCell>
                      <TableCell className="text-sm">{(insp.cities_ar || []).join("، ") || "—"}</TableCell>
                      <TableCell className="text-sm">{insp.assignedTasks}</TableCell>
                      <TableCell className="text-sm">{insp.completedTasks}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span className="text-sm font-medium">{insp.avg_rating.toFixed(1)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={insp.is_active ? "default" : "destructive"} className="text-xs">
                          {insp.is_active ? "نشط" : "موقوف"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {insp.lastActivity ? formatDate(insp.lastActivity) : "—"}
                      </TableCell>
                      <TableCell><CategoryBadge category={insp.inspector_category} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/inspectors/${insp.user_id}`); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
