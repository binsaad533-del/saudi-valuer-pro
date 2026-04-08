import { useState, useEffect, useMemo } from "react";
import { formatNumber } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  Search, UserCog, Eye, Ban, CheckCircle, Loader2, Users,
  RefreshCw, Crown, TrendingUp, ArrowUpDown, BarChart3,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { SARIcon } from "@/components/ui/saudi-riyal";
import {
  type UserRow, ROLE_LABELS, ROLE_COLORS,
  CategoryBadge, formatCurrencyJSX,
  RoleChangeDialog, CategoryOverrideDialog, ProfileDialog,
} from "./ClientDialogs";

// ── Classification Logic ──
const VIP_REVENUE = 50000;
const VIP_PROJECTS = 5;
const HIGH_VALUE_REVENUE = 20000;
const HIGH_VALUE_AVG = 10000;
const LOW_ACTIVITY_DAYS = 90;

function classifyClient(totalRevenue: number, projectCount: number, avgValue: number, lastActivity: string | null): string {
  if (totalRevenue >= VIP_REVENUE && projectCount >= VIP_PROJECTS) return "vip";
  if (totalRevenue >= HIGH_VALUE_REVENUE || avgValue >= HIGH_VALUE_AVG) return "high_value";
  if (lastActivity) {
    const days = differenceInDays(new Date(), new Date(lastActivity));
    if (days > LOW_ACTIVITY_DAYS && projectCount > 0) return "low_activity";
  }
  if (projectCount === 0 && !lastActivity) return "low_activity";
  return "regular";
}

type SortField = "name" | "revenue" | "projects" | "avgValue" | "date";

export default function ClientsManagement() {
  const { toast } = useToast();
  const { role: currentUserRole } = useAuth();
  const isSuperAdmin = currentUserRole === "owner";
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortAsc, setSortAsc] = useState(false);

  // Dialogs
  const [roleDialog, setRoleDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [categoryUser, setCategoryUser] = useState<UserRow | null>(null);
  const [profileDialog, setProfileDialog] = useState(false);
  const [profileUser, setProfileUser] = useState<UserRow | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name_ar, email, phone, created_at, account_status, client_category, client_category_manual, client_value_score")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = (profiles || []).map((p) => p.user_id);
      const [rolesRes, requestsRes, paymentsRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
        supabase.from("valuation_requests").select("id, client_user_id, created_at, total_fees").in("client_user_id", userIds),
        supabase.from("payments").select("request_id, amount, payment_status"),
      ]);

      const roleMap: Record<string, string> = {};
      (rolesRes.data || []).forEach((r) => { roleMap[r.user_id] = r.role; });

      const requestsByUser: Record<string, any[]> = {};
      (requestsRes.data || []).forEach((r) => {
        if (!requestsByUser[r.client_user_id]) requestsByUser[r.client_user_id] = [];
        requestsByUser[r.client_user_id].push(r);
      });

      const paidByRequest: Record<string, number> = {};
      (paymentsRes.data || []).forEach((p) => {
        if (p.payment_status === "paid") {
          paidByRequest[p.request_id] = (paidByRequest[p.request_id] || 0) + Number(p.amount);
        }
      });

      const combined: UserRow[] = (profiles || []).map((p) => {
        const userRequests = requestsByUser[p.user_id] || [];
        const projectCount = userRequests.length;
        let totalRevenue = 0;
        userRequests.forEach((req: any) => { totalRevenue += paidByRequest[req.id] || 0; });
        const avgProjectValue = projectCount > 0 ? totalRevenue / projectCount : 0;
        const lastReq = userRequests.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const lastActivity = lastReq?.created_at || null;
        const autoCategory = classifyClient(totalRevenue, projectCount, avgProjectValue, lastActivity);
        const effectiveCategory = p.client_category_manual ? (p.client_category || "regular") : autoCategory;
        return { ...p, role: roleMap[p.user_id] || "client", totalRevenue, projectCount, avgProjectValue, lastActivity, client_category: effectiveCategory, client_category_manual: p.client_category_manual ?? false, client_value_score: p.client_value_score ?? 0 };
      });
      setUsers(combined);
    } catch (err: any) {
      toast({ title: "خطأ في تحميل المستخدمين", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = useMemo(() => {
    let result = users.filter((u) => {
      const matchSearch = !search || u.full_name_ar.includes(search) || (u.email || "").includes(search) || (u.phone || "").includes(search);
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchCategory = categoryFilter === "all" || u.client_category === categoryFilter;
      return matchSearch && matchRole && matchCategory;
    });
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.full_name_ar.localeCompare(b.full_name_ar, "ar"); break;
        case "revenue": cmp = a.totalRevenue - b.totalRevenue; break;
        case "projects": cmp = a.projectCount - b.projectCount; break;
        case "avgValue": cmp = a.avgProjectValue - b.avgProjectValue; break;
        case "date": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [users, search, roleFilter, categoryFilter, sortField, sortAsc]);

  const stats = useMemo(() => ({
    total: users.length,
    vip: users.filter((u) => u.client_category === "vip").length,
    highValue: users.filter((u) => u.client_category === "high_value").length,
    totalRevenue: users.reduce((s, u) => s + u.totalRevenue, 0),
    top5: [...users].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5),
  }), [users]);

  const handleToggleStatus = async (user: UserRow) => {
    const newStatus = user.account_status === "active" ? "suspended" : "active";
    try {
      const { error } = await supabase.from("profiles").update({ account_status: newStatus }).eq("user_id", user.user_id);
      if (error) throw error;
      toast({ title: newStatus === "active" ? "تم تفعيل الحساب" : "تم إيقاف الحساب" });
      fetchUsers();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  return (
    <div className="space-y-6">
      {/* ── Insights Panel ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="w-5 h-5 text-primary" /></div>
          <div><p className="text-2xl font-bold text-foreground">{stats.total}</p><p className="text-xs text-muted-foreground">إجمالي المستخدمين</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Crown className="w-5 h-5 text-amber-600" /></div>
          <div><p className="text-2xl font-bold text-foreground">{stats.vip}</p><p className="text-xs text-muted-foreground">عملاء VIP</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
          <div><p className="text-2xl font-bold text-foreground">{stats.highValue}</p><p className="text-xs text-muted-foreground">عملاء مميزون</p></div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><SARIcon className="w-5 h-5 text-primary" /></div>
          <div><p className="text-lg font-bold text-foreground">{formatCurrencyJSX(stats.totalRevenue)}</p><p className="text-xs text-muted-foreground">إجمالي الإيرادات</p></div>
        </div>
      </div>

      {/* Top 5 */}
      {stats.top5.length > 0 && stats.top5[0].totalRevenue > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">أعلى 5 عملاء بالإيرادات</h3></div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {stats.top5.filter(u => u.totalRevenue > 0).map((u, i) => (
              <div key={u.id} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2.5">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-500 text-white" : "bg-muted-foreground/20 text-muted-foreground"}`}>{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{u.full_name_ar}</p><p className="text-[10px] text-muted-foreground">{formatCurrencyJSX(u.totalRevenue)}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم، البريد أو الجوال..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="التصنيف" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع التصنيفات</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="high_value">عميل مميز</SelectItem>
            <SelectItem value="regular">عادي</SelectItem>
            <SelectItem value="low_activity">نشاط منخفض</SelectItem>
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="الدور" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأدوار</SelectItem>
            <SelectItem value="client">عميل</SelectItem>
            <SelectItem value="inspector">معاين</SelectItem>
            <SelectItem value="financial_manager">مدير مالي</SelectItem>
            <SelectItem value="admin_coordinator">منسق إداري</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortField} onValueChange={(v) => { setSortField(v as SortField); setSortAsc(false); }}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="ترتيب" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date">تاريخ التسجيل</SelectItem>
            <SelectItem value="revenue">الإيرادات</SelectItem>
            <SelectItem value="projects">عدد المشاريع</SelectItem>
            <SelectItem value="avgValue">متوسط القيمة</SelectItem>
            <SelectItem value="name">الاسم</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => setSortAsc(!sortAsc)} title={sortAsc ? "تصاعدي" : "تنازلي"}><ArrowUpDown className="w-4 h-4" /></Button>
        <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </div>

      {/* ── Table ── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">لا توجد نتائج</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الجوال</TableHead>
                  <TableHead className="text-right">البريد</TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("revenue")}>
                    <span className="flex items-center gap-1">الإيرادات <ArrowUpDown className="w-3 h-3" /></span>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("projects")}>
                    <span className="flex items-center gap-1">المشاريع <ArrowUpDown className="w-3 h-3" /></span>
                  </TableHead>
                  <TableHead className="text-right">التصنيف</TableHead>
                  <TableHead className="text-right">الدور</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">آخر نشاط</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name_ar}</TableCell>
                    <TableCell dir="ltr" className="text-left text-sm">{user.phone || "—"}</TableCell>
                    <TableCell dir="ltr" className="text-left text-sm">{user.email || "—"}</TableCell>
                    <TableCell className="text-sm font-medium">{user.totalRevenue > 0 ? formatCurrencyJSX(user.totalRevenue) : "—"}</TableCell>
                    <TableCell className="text-sm">{user.projectCount || "—"}</TableCell>
                    <TableCell><CategoryBadge category={user.client_category} manual={user.client_category_manual} /></TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role || "client"]}`}>
                        {ROLE_LABELS[user.role || "client"]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.account_status === "active" ? "default" : "destructive"} className="text-xs">
                        {user.account_status === "active" ? "نشط" : "موقوف"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{user.lastActivity ? format(new Date(user.lastActivity), "yyyy/MM/dd") : "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        {isSuperAdmin && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="تغيير الدور"
                              onClick={() => { setSelectedUser(user); setRoleDialog(true); }}><UserCog className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="تغيير التصنيف"
                              onClick={() => { setCategoryUser(user); setCategoryDialog(true); }}><Crown className="w-3.5 h-3.5" /></Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="عرض الملف"
                          onClick={() => { setProfileUser(user); setProfileDialog(true); }}><Eye className="w-3.5 h-3.5" /></Button>
                        {isSuperAdmin && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title={user.account_status === "active" ? "إيقاف" : "تفعيل"}
                            onClick={() => handleToggleStatus(user)}>
                            {user.account_status === "active" ? <Ban className="w-3.5 h-3.5 text-destructive" /> : <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <RoleChangeDialog open={roleDialog} onOpenChange={setRoleDialog} user={selectedUser} onSuccess={fetchUsers} />
      <CategoryOverrideDialog open={categoryDialog} onOpenChange={setCategoryDialog} user={categoryUser} onSuccess={fetchUsers} />
      <ProfileDialog open={profileDialog} onOpenChange={setProfileDialog} user={profileUser} />
    </div>
  );
}
