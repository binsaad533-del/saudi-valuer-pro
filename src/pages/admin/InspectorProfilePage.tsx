import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  User, Mail, Phone, MapPin, Star, Award, TrendingUp, Clock,
  CheckCircle2, XCircle, AlertTriangle, Loader2, ArrowRight,
  Shield, FileText, BarChart3, Activity, Edit, Ban, CheckCircle,
  Calendar, Briefcase, Globe, Hash, MessageSquare,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import TopBar from "@/components/layout/TopBar";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  top_performer: { label: "أداء متميز", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200" },
  excellent: { label: "ممتاز", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200" },
  good: { label: "جيد", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200" },
  needs_attention: { label: "يحتاج متابعة", color: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-200" },
  under_review: { label: "تحت المراجعة", color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200" },
};

export default function InspectorProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [inspector, setInspector] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [inspections, setInspections] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);

  // Dialogs
  const [evalDialog, setEvalDialog] = useState(false);
  const [evalRating, setEvalRating] = useState("4");
  const [evalNotes, setEvalNotes] = useState("");
  const [evalSpeed, setEvalSpeed] = useState("4");
  const [evalQuality, setEvalQuality] = useState("4");
  const [evalSaving, setEvalSaving] = useState(false);

  const [noteDialog, setNoteDialog] = useState(false);
  const [mgmtNote, setMgmtNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const [categoryDialog, setCategoryDialog] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  useEffect(() => {
    if (userId) loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inspRes, profRes, taskRes, evalRes] = await Promise.all([
        supabase.from("inspector_profiles").select("*").eq("user_id", userId!).maybeSingle(),
        supabase.from("profiles").select("*").eq("user_id", userId!).maybeSingle(),
        supabase.from("inspections").select("*").eq("inspector_id", userId!).order("created_at", { ascending: false }),
        supabase.from("inspector_evaluations").select("*").eq("inspector_user_id", userId!).order("created_at", { ascending: false }),
      ]);
      setInspector(inspRes.data);
      setProfile(profRes.data);
      setInspections(taskRes.data || []);
      setEvaluations(evalRes.data || []);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Computed Stats ──
  const taskStats = {
    total: inspections.length,
    completed: inspections.filter((i) => i.status === "submitted" || i.status === "reviewed" || i.completed).length,
    pending: inspections.filter((i) => i.status === "assigned").length,
    inProgress: inspections.filter((i) => i.status === "in_progress").length,
    delayed: inspections.filter((i) => {
      if (i.completed || i.status === "submitted" || i.status === "reviewed") return false;
      return differenceInDays(new Date(), new Date(i.inspection_date)) > 3;
    }).length,
    cancelled: inspections.filter((i) => i.status === "cancelled").length,
    completionRate: inspections.length > 0
      ? Math.round((inspections.filter((i) => i.status === "submitted" || i.status === "reviewed" || i.completed).length / inspections.length) * 100) : 0,
    thisMonth: inspections.filter((i) => {
      const d = new Date(i.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
    thisYear: inspections.filter((i) => new Date(i.created_at).getFullYear() === new Date().getFullYear()).length,
  };

  const avgRating = evaluations.length > 0
    ? (evaluations.reduce((s, e) => s + Number(e.rating), 0) / evaluations.length).toFixed(1) : "—";

  // Monthly performance data for chart
  const monthlyData = (() => {
    const months: Record<string, { month: string; completed: number; assigned: number }> = {};
    inspections.forEach((i) => {
      const m = format(new Date(i.created_at), "yyyy-MM");
      if (!months[m]) months[m] = { month: m, completed: 0, assigned: 0 };
      months[m].assigned++;
      if (i.completed || i.status === "submitted" || i.status === "reviewed") months[m].completed++;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  })();

  // ── Handlers ──
  const handleAddEvaluation = async () => {
    setEvalSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مصرح");
      const { error } = await supabase.from("inspector_evaluations").insert({
        inspector_user_id: userId!,
        evaluator_id: user.id,
        evaluation_type: "internal",
        rating: Number(evalRating),
        speed_score: Number(evalSpeed),
        quality_score: Number(evalQuality),
        notes: evalNotes,
      });
      if (error) throw error;
      toast({ title: "تم إضافة التقييم بنجاح" });
      setEvalDialog(false);
      setEvalNotes("");
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally { setEvalSaving(false); }
  };

  const handleSaveNote = async () => {
    setNoteSaving(true);
    try {
      const { error } = await supabase.from("inspector_profiles")
        .update({ management_notes: mgmtNote })
        .eq("user_id", userId!);
      if (error) throw error;
      toast({ title: "تم حفظ الملاحظة" });
      setNoteDialog(false);
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally { setNoteSaving(false); }
  };

  const handleChangeCategory = async () => {
    setCatSaving(true);
    try {
      const { error } = await supabase.from("inspector_profiles")
        .update({ inspector_category: newCategory })
        .eq("user_id", userId!);
      if (error) throw error;
      toast({ title: "تم تغيير التصنيف" });
      setCategoryDialog(false);
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally { setCatSaving(false); }
  };

  const handleToggleActive = async () => {
    try {
      const { error } = await supabase.from("inspector_profiles")
        .update({ is_active: !inspector?.is_active })
        .eq("user_id", userId!);
      if (error) throw error;
      toast({ title: inspector?.is_active ? "تم إيقاف المعاين" : "تم تفعيل المعاين" });
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar />
        <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!inspector || !profile) {
    return (
      <div className="min-h-screen">
        <TopBar />
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-muted-foreground">لم يتم العثور على ملف المعاين</p>
          <Button variant="outline" onClick={() => navigate("/inspectors")}>
            <ArrowRight className="w-4 h-4 ml-2" /> العودة للقائمة
          </Button>
        </div>
      </div>
    );
  }

  const catCfg = CATEGORY_CONFIG[inspector.inspector_category || "good"] || CATEGORY_CONFIG.good;

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {profile.full_name_ar?.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{profile.full_name_ar}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={inspector.is_active ? "default" : "destructive"}>{inspector.is_active ? "نشط" : "موقوف"}</Badge>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${catCfg.color}`}>
                  {catCfg.label}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setMgmtNote(inspector.management_notes || ""); setNoteDialog(true); }}>
              <MessageSquare className="w-4 h-4 ml-1" /> ملاحظة إدارية
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setNewCategory(inspector.inspector_category || "good"); setCategoryDialog(true); }}>
              <Award className="w-4 h-4 ml-1" /> تغيير التصنيف
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setEvalDialog(true); }}>
              <Star className="w-4 h-4 ml-1" /> إضافة تقييم
            </Button>
            <Button variant={inspector.is_active ? "destructive" : "default"} size="sm" onClick={handleToggleActive}>
              {inspector.is_active ? <Ban className="w-4 h-4 ml-1" /> : <CheckCircle className="w-4 h-4 ml-1" />}
              {inspector.is_active ? "إيقاف" : "تفعيل"}
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: FileText, label: "إجمالي المهام", value: taskStats.total, color: "text-primary" },
            { icon: CheckCircle2, label: "مكتملة", value: taskStats.completed, color: "text-emerald-600" },
            { icon: Clock, label: "قيد الانتظار", value: taskStats.pending, color: "text-amber-600" },
            { icon: AlertTriangle, label: "متأخرة", value: taskStats.delayed, color: "text-destructive" },
            { icon: Star, label: "التقييم", value: avgRating, color: "text-amber-500" },
            { icon: TrendingUp, label: "نسبة الإنجاز", value: `${taskStats.completionRate}%`, color: "text-primary" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-card rounded-xl border border-border p-3 text-center">
              <kpi.icon className={`w-5 h-5 mx-auto mb-1 ${kpi.color}`} />
              <p className="text-xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info" dir="rtl">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="info" className="text-xs gap-1"><User className="w-3.5 h-3.5" /> المعلومات</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs gap-1"><BarChart3 className="w-3.5 h-3.5" /> الأداء</TabsTrigger>
            <TabsTrigger value="quality" className="text-xs gap-1"><Shield className="w-3.5 h-3.5" /> الجودة</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1"><Activity className="w-3.5 h-3.5" /> سجل النشاط</TabsTrigger>
          </TabsList>

          {/* ── Info Tab ── */}
          <TabsContent value="info" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Basic Info */}
              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><User className="w-4 h-4 text-primary" /> المعلومات الأساسية</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoItem icon={User} label="الاسم" value={profile.full_name_ar} />
                  <InfoItem icon={Mail} label="البريد" value={profile.email} dir="ltr" />
                  <InfoItem icon={Phone} label="الجوال" value={profile.phone} dir="ltr" />
                  <InfoItem icon={MapPin} label="المدن" value={(inspector.cities_ar || []).join("، ")} />
                  <InfoItem icon={Globe} label="المناطق" value={(inspector.regions_ar || []).join("، ")} />
                  <InfoItem icon={Calendar} label="تاريخ الانضمام" value={format(new Date(profile.created_at), "yyyy/MM/dd")} />
                  <InfoItem icon={Briefcase} label="نوع التوظيف" value={inspector.employment_type === "full_time" ? "دوام كامل" : "جزئي"} />
                  <InfoItem icon={Hash} label="الجنسية" value={inspector.nationality || "—"} />
                </div>
              </div>

              {/* Professional Info */}
              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Briefcase className="w-4 h-4 text-primary" /> المعلومات المهنية</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoItem icon={Hash} label="رقم المعاين" value={inspector.id?.slice(0, 8)} dir="ltr" />
                  <InfoItem icon={MapPin} label="الفرع" value={inspector.branch || "—"} />
                  <InfoItem icon={Shield} label="التخصصات" value={(inspector.specializations || []).join("، ") || "—"} />
                  <InfoItem icon={Star} label="التقييم الكلي" value={`${inspector.overall_score || 0}/100`} />
                  <InfoItem icon={Award} label="الحالة" value={inspector.availability_status === "available" ? "متاح" : "مشغول"} />
                  <InfoItem icon={FileText} label="الشهادات" value={(inspector.certifications || []).join("، ") || "—"} />
                </div>
                {inspector.management_notes && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">ملاحظات الإدارة:</p>
                    <p>{inspector.management_notes}</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Performance Tab ── */}
          <TabsContent value="performance" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Task Stats */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> إحصائيات المهام</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "مهام هذا الشهر", value: taskStats.thisMonth },
                    { label: "مهام هذا العام", value: taskStats.thisYear },
                    { label: "قيد التنفيذ", value: taskStats.inProgress },
                    { label: "ملغاة", value: taskStats.cancelled },
                    { label: "متوسط الاستجابة", value: `${inspector.avg_response_hours || "—"} ساعة` },
                    { label: "متوسط الإنجاز", value: `${inspector.avg_completion_hours || "—"} ساعة` },
                  ].map((s) => (
                    <div key={s.label} className="bg-muted/50 rounded-lg p-3">
                      <p className="text-lg font-bold text-foreground">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly Chart */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> الأداء الشهري</h3>
                {monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="assigned" name="المسندة" fill="hsl(var(--primary))" opacity={0.3} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" name="المكتملة" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-8">لا توجد بيانات كافية</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Quality Tab ── */}
          <TabsContent value="quality" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "معاينات معتمدة", value: inspector.approved_count || 0, icon: CheckCircle2, color: "text-emerald-600" },
                { label: "مرفوضة / مُعادة", value: inspector.rejected_count || 0, icon: XCircle, color: "text-destructive" },
                { label: "شكاوى", value: inspector.complaints_count || 0, icon: AlertTriangle, color: "text-amber-600" },
                { label: "تصحيحات مطلوبة", value: inspector.corrections_count || 0, icon: Edit, color: "text-orange-600" },
              ].map((q) => (
                <div key={q.label} className="bg-card rounded-xl border border-border p-4 text-center">
                  <q.icon className={`w-6 h-6 mx-auto mb-1 ${q.color}`} />
                  <p className="text-xl font-bold">{q.value}</p>
                  <p className="text-[10px] text-muted-foreground">{q.label}</p>
                </div>
              ))}
            </div>

            {/* Evaluations List */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> سجل التقييمات ({evaluations.length})</h3>
              {evaluations.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">لا توجد تقييمات بعد</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {evaluations.map((ev) => (
                    <div key={ev.id} className="flex items-start justify-between bg-muted/50 rounded-lg p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`w-3 h-3 ${s <= ev.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {ev.evaluation_type === "internal" ? "تقييم داخلي" : "تقييم عميل"}
                          </Badge>
                        </div>
                        {ev.notes && <p className="text-xs text-muted-foreground mt-1">{ev.notes}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(ev.created_at), "yyyy/MM/dd")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Activity Log Tab ── */}
          <TabsContent value="activity" className="mt-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> سجل المعاينات</h3>
              {inspections.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">لا توجد معاينات</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {inspections.map((insp) => (
                    <div key={insp.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          insp.completed || insp.status === "submitted" || insp.status === "reviewed"
                            ? "bg-emerald-500" : insp.status === "in_progress" ? "bg-amber-500" : "bg-blue-500"
                        }`} />
                        <div>
                          <p className="text-sm font-medium">{insp.assignment_id?.slice(0, 8)}...</p>
                          <p className="text-[10px] text-muted-foreground">{insp.inspection_date}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <Badge variant="outline" className="text-[10px]">
                          {insp.status === "submitted" ? "مُرسلة" : insp.status === "reviewed" ? "مُراجعة" : insp.status === "in_progress" ? "جارية" : insp.status === "assigned" ? "مُسندة" : insp.status}
                        </Badge>
                        {insp.submitted_at && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(insp.submitted_at), "HH:mm yyyy/MM/dd")}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Evaluation Dialog ── */}
      <Dialog open={evalDialog} onOpenChange={setEvalDialog}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Star className="w-5 h-5 text-amber-500" /> إضافة تقييم</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium">التقييم العام</label>
                <Select value={evalRating} onValueChange={setEvalRating}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} / 5</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">السرعة</label>
                <Select value={evalSpeed} onValueChange={setEvalSpeed}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} / 5</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">الجودة</label>
                <Select value={evalQuality} onValueChange={setEvalQuality}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} / 5</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">ملاحظات</label>
              <Textarea value={evalNotes} onChange={(e) => setEvalNotes(e.target.value)} placeholder="ملاحظات حول أداء المعاين..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvalDialog(false)}>إلغاء</Button>
            <Button onClick={handleAddEvaluation} disabled={evalSaving}>
              {evalSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />} حفظ التقييم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Management Note Dialog ── */}
      <Dialog open={noteDialog} onOpenChange={setNoteDialog}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>ملاحظة إدارية</DialogTitle></DialogHeader>
          <Textarea value={mgmtNote} onChange={(e) => setMgmtNote(e.target.value)} placeholder="اكتب ملاحظة إدارية عن المعاين..." rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog(false)}>إلغاء</Button>
            <Button onClick={handleSaveNote} disabled={noteSaving}>
              {noteSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />} حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Category Dialog ── */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Award className="w-5 h-5 text-amber-600" /> تغيير تصنيف المعاين</DialogTitle></DialogHeader>
          <Select value={newCategory} onValueChange={setNewCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog(false)}>إلغاء</Button>
            <Button onClick={handleChangeCategory} disabled={catSaving}>
              {catSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />} تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value, dir }: { icon: React.ElementType; label: string; value: string | null | undefined; dir?: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</p>
      <p className="font-medium text-sm mt-0.5" dir={dir}>{value || "—"}</p>
    </div>
  );
}
