import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  UserCog,
  Eye,
  Ban,
  CheckCircle,
  Loader2,
  Users,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";

interface UserRow {
  id: string;
  user_id: string;
  full_name_ar: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  account_status: string;
  role?: string;
}

const ROLE_LABELS: Record<string, string> = {
  client: "عميل",
  inspector: "معاين ميداني",
  auditor: "مراقب",
  super_admin: "مدير النظام",
  firm_admin: "مدير المنشأة",
  valuer: "مقيّم",
  reviewer: "مراجع",
};

const ROLE_COLORS: Record<string, string> = {
  client: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  inspector: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  auditor: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  super_admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  firm_admin: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  valuer: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  reviewer: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

const ASSIGNABLE_ROLES = ["client", "inspector", "auditor", "firm_admin"] as const;

export default function ClientsManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Role change dialog
  const [roleDialog, setRoleDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [newRole, setNewRole] = useState("");
  const [changing, setChanging] = useState(false);

  // Profile dialog
  const [profileDialog, setProfileDialog] = useState(false);
  const [profileUser, setProfileUser] = useState<UserRow | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name_ar, email, phone, created_at, account_status")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch roles for all users
      const userIds = (profiles || []).map((p) => p.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const roleMap: Record<string, string> = {};
      (roles || []).forEach((r) => {
        roleMap[r.user_id] = r.role;
      });

      const combined = (profiles || []).map((p) => ({
        ...p,
        role: roleMap[p.user_id] || "client",
      }));

      setUsers(combined);
    } catch (err: any) {
      toast({ title: "خطأ في تحميل المستخدمين", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChangeRole = async () => {
    if (!selectedUser || !newRole) return;
    setChanging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مصرح");

      const oldRole = selectedUser.role || "client";

      // Check if user already has a role entry
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", selectedUser.user_id)
        .single();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole as any })
          .eq("user_id", selectedUser.user_id);
        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: selectedUser.user_id, role: newRole as any });
        if (error) throw error;
      }

      // Log the change
      const { error: logError } = await supabase
        .from("role_change_log")
        .insert({
          user_id: selectedUser.user_id,
          old_role: oldRole,
          new_role: newRole,
          changed_by: user.id,
        });
      if (logError) console.error("Failed to log role change:", logError);

      toast({ title: "تم تغيير الدور بنجاح", description: `تم تغيير دور ${selectedUser.full_name_ar} إلى ${ROLE_LABELS[newRole]}` });
      setRoleDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setChanging(false);
    }
  };

  const handleToggleStatus = async (user: UserRow) => {
    const newStatus = user.account_status === "active" ? "suspended" : "active";
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ account_status: newStatus })
        .eq("user_id", user.user_id);
      if (error) throw error;

      toast({
        title: newStatus === "active" ? "تم تفعيل الحساب" : "تم إيقاف الحساب",
        description: user.full_name_ar,
      });
      fetchUsers();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.full_name_ar.includes(search) ||
      (u.email || "").includes(search) ||
      (u.phone || "").includes(search);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total: users.length,
    active: users.filter((u) => u.account_status === "active").length,
    suspended: users.filter((u) => u.account_status === "suspended").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">إجمالي المستخدمين</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.active}</p>
            <p className="text-xs text-muted-foreground">حسابات نشطة</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Ban className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.suspended}</p>
            <p className="text-xs text-muted-foreground">حسابات موقوفة</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم، البريد أو الجوال..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="فلترة حسب الدور" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأدوار</SelectItem>
            <SelectItem value="client">عميل</SelectItem>
            <SelectItem value="inspector">معاين</SelectItem>
            <SelectItem value="auditor">مراقب</SelectItem>
            <SelectItem value="firm_admin">مدير</SelectItem>
            <SelectItem value="valuer">مقيّم</SelectItem>
            <SelectItem value="reviewer">مراجع</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            لا توجد نتائج
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">الجوال</TableHead>
                <TableHead className="text-right">البريد</TableHead>
                <TableHead className="text-right">تاريخ التسجيل</TableHead>
                <TableHead className="text-right">الدور</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name_ar}</TableCell>
                  <TableCell dir="ltr" className="text-left">{user.phone || "—"}</TableCell>
                  <TableCell dir="ltr" className="text-left">{user.email || "—"}</TableCell>
                  <TableCell>{format(new Date(user.created_at), "yyyy/MM/dd")}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role || "client"]}`}>
                      {ROLE_LABELS[user.role || "client"]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.account_status === "active" ? "default" : "destructive"}>
                      {user.account_status === "active" ? "نشط" : "موقوف"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="تغيير الدور"
                        onClick={() => {
                          setSelectedUser(user);
                          setNewRole(user.role || "client");
                          setRoleDialog(true);
                        }}
                      >
                        <UserCog className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="عرض الملف"
                        onClick={() => {
                          setProfileUser(user);
                          setProfileDialog(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={user.account_status === "active" ? "إيقاف" : "تفعيل"}
                        onClick={() => handleToggleStatus(user)}
                      >
                        {user.account_status === "active" ? (
                          <Ban className="w-4 h-4 text-destructive" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Role Change Dialog */}
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              تغيير دور المستخدم
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium">{selectedUser.full_name_ar}</p>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  الدور الحالي: <span className="font-medium">{ROLE_LABELS[selectedUser.role || "client"]}</span>
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">الدور الجديد</label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(false)}>إلغاء</Button>
            <Button onClick={handleChangeRole} disabled={changing || newRole === selectedUser?.role}>
              {changing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              تأكيد التغيير
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile View Dialog */}
      <Dialog open={profileDialog} onOpenChange={setProfileDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ملف المستخدم</DialogTitle>
          </DialogHeader>
          {profileUser && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">الاسم</p>
                  <p className="font-medium">{profileUser.full_name_ar}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">البريد</p>
                  <p className="font-medium" dir="ltr">{profileUser.email || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">الجوال</p>
                  <p className="font-medium" dir="ltr">{profileUser.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">تاريخ التسجيل</p>
                  <p className="font-medium">{format(new Date(profileUser.created_at), "yyyy/MM/dd")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">الدور</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[profileUser.role || "client"]}`}>
                    {ROLE_LABELS[profileUser.role || "client"]}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground">الحالة</p>
                  <Badge variant={profileUser.account_status === "active" ? "default" : "destructive"}>
                    {profileUser.account_status === "active" ? "نشط" : "موقوف"}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
