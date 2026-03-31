import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Eye,
  Search,
  LogOut,
  Shield,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending_assignment: "بانتظار التعيين",
  assigned: "تم التعيين",
  inspection_scheduled: "المعاينة مجدولة",
  inspection_in_progress: "المعاينة جارية",
  inspection_submitted: "المعاينة مرفوعة",
  analysis: "التحليل",
  draft_report: "مسودة التقرير",
  review: "المراجعة",
  correction: "التصحيح",
  approved: "معتمد",
  issued: "صادر",
  delivered: "تم التسليم",
  archived: "مؤرشف",
};

export default function AuditorDashboard() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    checkAccess();
    fetchRequests();
  }, []);

  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/client/login"); return; }
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (role?.role !== "financial_manager") {
      toast.error("ليس لديك صلاحية الوصول");
      navigate("/client/login");
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("valuation_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch {
      // auditor may not have access yet
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    navigate("/client/login");
  };

  const filtered = requests.filter(
    (r) =>
      !search ||
      (r.reference_number || "").includes(search) ||
      (r.property_city_ar || "").includes(search)
  );

  const stats = {
    total: requests.length,
    active: requests.filter((r) => !["archived", "closed"].includes(r.status)).length,
    review: requests.filter((r) => r.status === "review").length,
    correction: requests.filter((r) => r.status === "correction").length,
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="جساس" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="text-lg font-bold text-foreground">لوحة المراقبة</h1>
            <p className="text-xs text-muted-foreground">مراقب الجودة والامتثال</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 ml-2" />
          خروج
        </Button>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">إجمالي الطلبات</p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-xs text-muted-foreground">طلبات نشطة</p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.review}</p>
              <p className="text-xs text-muted-foreground">قيد المراجعة</p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.correction}</p>
              <p className="text-xs text-muted-foreground">تحتاج تصحيح</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالرقم المرجعي أو المدينة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        {/* Read-only Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">لا توجد طلبات</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الرقم المرجعي</TableHead>
                  <TableHead className="text-right">المدينة</TableHead>
                  <TableHead className="text-right">نوع العقار</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">تاريخ الطلب</TableHead>
                  <TableHead className="text-right">عرض</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-sm">{req.reference_number || "—"}</TableCell>
                    <TableCell>{req.property_city_ar || "—"}</TableCell>
                    <TableCell>{req.property_type || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{STATUS_LABELS[req.status] || req.status}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(req.created_at), "yyyy/MM/dd")}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          ⚠️ لوحة المراقبة للعرض فقط — لا يمكن تعديل أو حذف أي بيانات
        </p>
      </div>
    </div>
  );
}
