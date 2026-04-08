/**
 * Client dialogs and shared types/constants
 * Extracted from ClientsManagement for modularity
 */
import { useState } from "react";
import { formatNumber } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ShieldCheck, Crown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { SAR } from "@/components/ui/saudi-riyal";

export interface UserRow {
  id: string; user_id: string; full_name_ar: string; email: string | null; phone: string | null;
  created_at: string; account_status: string; client_category: string; client_category_manual: boolean;
  client_value_score: number; role?: string; totalRevenue: number; projectCount: number;
  avgProjectValue: number; lastActivity: string | null;
}

export const ROLE_LABELS: Record<string, string> = {
  client: "عميل", inspector: "معاين ميداني", owner: "مالك المنصة",
  financial_manager: "مدير مالي", admin_coordinator: "منسق إداري",
};
export const ROLE_COLORS: Record<string, string> = {
  client: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  inspector: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  owner: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  financial_manager: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  admin_coordinator: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};
export const ASSIGNABLE_ROLES = ["client", "inspector", "financial_manager", "admin_coordinator"] as const;

export const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  vip: { label: "VIP", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700" },
  high_value: { label: "عميل مميز", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700" },
  regular: { label: "عميل عادي", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700" },
  low_activity: { label: "نشاط منخفض", color: "bg-muted text-muted-foreground border-border" },
};
export const CATEGORY_OPTIONS = ["vip", "high_value", "regular", "low_activity"] as const;

export function CategoryBadge({ category, manual }: { category: string; manual?: boolean }) {
  const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.regular;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
      {cfg.label}
      {manual && <span className="text-[10px] opacity-60">(يدوي)</span>}
    </span>
  );
}

export const formatCurrencyJSX = (v: number) => (
  <span className="inline-flex items-center gap-1">{formatNumber(v)} <SAR size={12} /></span>
);

// ── Role Change Dialog ──
export function RoleChangeDialog({ open, onOpenChange, user, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; user: UserRow | null; onSuccess: () => void }) {
  const { toast } = useToast();
  const [newRole, setNewRole] = useState(user?.role || "client");
  const [changing, setChanging] = useState(false);

  const handleChange = async () => {
    if (!user || !newRole) return;
    setChanging(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("غير مصرح");
      const { data: existing } = await supabase.from("user_roles").select("id").eq("user_id", user.user_id).single();
      if (existing) { const { error } = await supabase.from("user_roles").update({ role: newRole as any }).eq("user_id", user.user_id); if (error) throw error; }
      else { const { error } = await supabase.from("user_roles").insert({ user_id: user.user_id, role: newRole as any }); if (error) throw error; }
      await supabase.from("role_change_log").insert({ user_id: user.user_id, old_role: user.role || "client", new_role: newRole, changed_by: authUser.id });
      toast({ title: "تم تغيير الدور بنجاح" }); onOpenChange(false); onSuccess();
    } catch (err: any) { toast({ title: "خطأ", description: err.message, variant: "destructive" }); }
    finally { setChanging(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> تغيير دور المستخدم</DialogTitle></DialogHeader>
        {user && (<div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3"><p className="font-medium">{user.full_name_ar}</p><p className="text-sm text-muted-foreground">{user.email}</p></div>
          <Select value={newRole} onValueChange={setNewRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ASSIGNABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent></Select>
        </div>)}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleChange} disabled={changing || newRole === user?.role}>{changing && <Loader2 className="w-4 h-4 animate-spin ml-2" />} تأكيد</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Category Override Dialog ──
export function CategoryOverrideDialog({ open, onOpenChange, user, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; user: UserRow | null; onSuccess: () => void }) {
  const { toast } = useToast();
  const [newCategory, setNewCategory] = useState(user?.client_category || "regular");
  const [changing, setChanging] = useState(false);

  const handleChange = async () => {
    if (!user || !newCategory) return;
    setChanging(true);
    try {
      const { error } = await supabase.from("profiles").update({ client_category: newCategory, client_category_manual: true }).eq("user_id", user.user_id);
      if (error) throw error;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) await supabase.from("role_change_log").insert({ user_id: user.user_id, old_role: `category:${user.client_category}`, new_role: `category:${newCategory}`, changed_by: authUser.id, reason: "manual_category_override" });
      toast({ title: "تم تغيير تصنيف العميل" }); onOpenChange(false); onSuccess();
    } catch (err: any) { toast({ title: "خطأ", description: err.message, variant: "destructive" }); }
    finally { setChanging(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-amber-600" /> تغيير تصنيف العميل</DialogTitle></DialogHeader>
        {user && (<div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium">{user.full_name_ar}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground"><span>الإيرادات: {formatCurrencyJSX(user.totalRevenue)}</span><span>•</span><span>المشاريع: {user.projectCount}</span></div>
            <div className="mt-2"><span className="text-xs text-muted-foreground ml-1">التصنيف الحالي:</span><CategoryBadge category={user.client_category} manual={user.client_category_manual} /></div>
          </div>
          <Select value={newCategory} onValueChange={setNewCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{CATEGORY_CONFIG[c].label}</SelectItem>)}</SelectContent></Select>
          <p className="text-xs text-muted-foreground">⚠️ التغيير اليدوي سيُسجَّل ولن يتأثر بالحساب التلقائي</p>
        </div>)}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleChange} disabled={changing || newCategory === user?.client_category}>{changing && <Loader2 className="w-4 h-4 animate-spin ml-2" />} تأكيد التصنيف</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Profile Dialog ──
export function ProfileDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (o: boolean) => void; user: UserRow | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>ملف المستخدم</DialogTitle></DialogHeader>
        {user && (<div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted-foreground">الاسم</p><p className="font-medium">{user.full_name_ar}</p></div>
            <div><p className="text-muted-foreground">البريد</p><p className="font-medium" dir="ltr">{user.email || "—"}</p></div>
            <div><p className="text-muted-foreground">الجوال</p><p className="font-medium" dir="ltr">{user.phone || "—"}</p></div>
            <div><p className="text-muted-foreground">تاريخ التسجيل</p><p className="font-medium">{format(new Date(user.created_at), "yyyy/MM/dd")}</p></div>
          </div>
          <div className="border-t border-border pt-3 grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted-foreground">إجمالي الإيرادات</p><p className="font-bold text-primary">{formatCurrencyJSX(user.totalRevenue)}</p></div>
            <div><p className="text-muted-foreground">عدد المشاريع</p><p className="font-bold">{user.projectCount}</p></div>
            <div><p className="text-muted-foreground">متوسط قيمة المشروع</p><p className="font-medium">{formatCurrencyJSX(user.avgProjectValue)}</p></div>
            <div><p className="text-muted-foreground">آخر نشاط</p><p className="font-medium">{user.lastActivity ? format(new Date(user.lastActivity), "yyyy/MM/dd") : "—"}</p></div>
          </div>
          <div className="border-t border-border pt-3 flex items-center gap-4">
            <div><p className="text-xs text-muted-foreground mb-1">التصنيف</p><CategoryBadge category={user.client_category} manual={user.client_category_manual} /></div>
            <div><p className="text-xs text-muted-foreground mb-1">الدور</p><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role || "client"]}`}>{ROLE_LABELS[user.role || "client"]}</span></div>
            <div><p className="text-xs text-muted-foreground mb-1">الحالة</p><Badge variant={user.account_status === "active" ? "default" : "destructive"}>{user.account_status === "active" ? "نشط" : "موقوف"}</Badge></div>
          </div>
        </div>)}
      </DialogContent>
    </Dialog>
  );
}
