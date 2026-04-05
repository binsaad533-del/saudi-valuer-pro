import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import TopBar from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  User, Building2, Phone, Mail, Link2, Plus, FileText, Edit3,
  Download, Archive, Loader2, CheckCircle2, UserPlus, UserCheck,
  AlertCircle, Save, StickyNote, ArrowRight,
} from "lucide-react";

interface ClientRecord {
  id: string;
  name_ar: string;
  name_en: string | null;
  email: string | null;
  phone: string | null;
  cr_number: string | null;
  client_type: string;
  client_status: string;
  portal_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  contact_person_ar: string | null;
  contact_person_en: string | null;
  address_ar: string | null;
  city_ar: string | null;
  notes: string | null;
  id_number: string | null;
  id_type: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  potential: { label: "بدون حساب", color: "bg-muted text-muted-foreground", icon: UserPlus },
  verified: { label: "عميل مؤكد", color: "bg-info/10 text-info", icon: UserCheck },
  portal: { label: "لديه حساب", color: "bg-success/10 text-success", icon: CheckCircle2 },
};

export default function ClientProfilePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Assignments (active requests)
  const [assignments, setAssignments] = useState<any[]>([]);
  // Completed reports (issued assignments)
  const [completedReports, setCompletedReports] = useState<any[]>([]);
  // Archived reports
  const [archivedReports, setArchivedReports] = useState<any[]>([]);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ClientRecord>>({});
  const [saving, setSaving] = useState(false);

  // Internal notes
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const fetchClient = async () => {
    if (!clientId) return;
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();
    if (error || !data) {
      toast.error("لم يتم العثور على العميل");
      return;
    }
    setClient(data as ClientRecord);
    setNoteText(data.notes || "");
  };

  const fetchAssignments = async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from("valuation_assignments")
      .select("id, reference_number, status, created_at, property_type")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    const all = data || [];
    setAssignments(all.filter(a => !["approved", "issued"].includes(a.status)));
    setCompletedReports(all.filter(a => ["approved", "issued"].includes(a.status)));
  };

  const fetchArchived = async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from("archived_reports")
      .select("id, report_number, report_date, file_path, file_name, report_title_ar")
      .eq("client_id", clientId)
      .order("report_date", { ascending: false });
    setArchivedReports(data || []);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchClient(), fetchAssignments(), fetchArchived()]).finally(() => setLoading(false));
  }, [clientId]);

  const handleEdit = () => {
    if (!client) return;
    setEditForm({
      name_ar: client.name_ar,
      phone: client.phone,
      email: client.email,
      contact_person_ar: client.contact_person_ar,
      address_ar: client.address_ar,
      city_ar: client.city_ar,
      cr_number: client.cr_number,
      id_number: client.id_number,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!client) return;
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({ ...editForm, updated_at: new Date().toISOString() })
      .eq("id", client.id);
    if (error) toast.error("فشل حفظ التعديلات");
    else {
      toast.success("تم حفظ التعديلات");
      setEditOpen(false);
      fetchClient();
    }
    setSaving(false);
  };

  const handleSaveNote = async () => {
    if (!client) return;
    setSavingNote(true);
    const { error } = await supabase
      .from("clients")
      .update({ notes: noteText, updated_at: new Date().toISOString() })
      .eq("id", client.id);
    if (error) toast.error("فشل حفظ الملاحظة");
    else toast.success("تم حفظ الملاحظة");
    setSavingNote(false);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: "مسودة", variant: "outline" },
      submitted: { label: "مقدم", variant: "secondary" },
      processing: { label: "قيد المعالجة", variant: "secondary" },
      inspection: { label: "معاينة", variant: "secondary" },
      under_review: { label: "قيد المراجعة", variant: "default" },
      approved: { label: "معتمد", variant: "default" },
      issued: { label: "صادر", variant: "default" },
      rejected: { label: "مرفوض", variant: "destructive" },
      cancelled: { label: "ملغي", variant: "destructive" },
    };
    const m = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={m.variant} className="text-[11px]">{m.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar />
        <div className="flex justify-center items-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen">
        <TopBar />
        <div className="text-center py-32 text-muted-foreground">
          <AlertCircle className="w-10 h-10 mx-auto mb-3" />
          <p>لم يتم العثور على سجل العميل</p>
        </div>
      </div>
    );
  }

  const stCfg = STATUS_MAP[client.client_status] || STATUS_MAP.potential;
  const StIcon = stCfg.icon;

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* ─── HEADER ─── */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  {client.client_type === "company"
                    ? <Building2 className="w-7 h-7 text-primary" />
                    : <User className="w-7 h-7 text-primary" />}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">{client.name_ar}</h1>
                  {client.contact_person_ar && (
                    <p className="text-sm text-muted-foreground mt-0.5">{client.contact_person_ar}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${stCfg.color}`}>
                      <StIcon className="w-3.5 h-3.5" />
                      {stCfg.label}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {client.client_type === "company" ? "شركة" : "فرد"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                    {client.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        <span dir="ltr">{client.phone}</span>
                      </span>
                    )}
                    {client.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        <span dir="ltr">{client.email}</span>
                      </span>
                    )}
                    {client.city_ar && (
                      <span className="text-xs">{client.city_ar}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="gap-1.5" onClick={() => navigate("/valuations/new")}>
                  <Plus className="w-4 h-4" /> طلب جديد
                </Button>
                {!client.portal_user_id && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/clients-management")}>
                    <Link2 className="w-4 h-4" /> ربط بحساب
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleEdit}>
                  <Edit3 className="w-4 h-4" /> تعديل البيانات
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/archive")}>
                  <Archive className="w-4 h-4" /> إضافة تقرير أرشيفي
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── ACTIVE REQUESTS ─── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              الطلبات النشطة ({assignments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد طلبات نشطة</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم الطلب</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">نوع العقار</TableHead>
                      <TableHead className="text-right">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-sm">{a.reference_number || a.id.slice(0, 8)}</TableCell>
                        <TableCell>{statusBadge(a.status)}</TableCell>
                        <TableCell className="text-sm">{a.property_type || "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                            onClick={() => navigate(`/valuations/${a.id}`)}>
                            عرض <ArrowRight className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── COMPLETED REPORTS ─── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              التقارير المكتملة ({completedReports.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {completedReports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد تقارير مكتملة</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم التقرير</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedReports.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{r.reference_number || r.id.slice(0, 8)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("ar-SA")}
                        </TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                            onClick={() => navigate(`/valuations/${r.id}`)}>
                            <Download className="w-3 h-3" /> عرض
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── ARCHIVED REPORTS ─── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Archive className="w-4 h-4 text-muted-foreground" />
              التقارير الأرشيفية ({archivedReports.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {archivedReports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد تقارير أرشيفية</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم التقرير</TableHead>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-right">تاريخ التقرير</TableHead>
                      <TableHead className="text-right">تحميل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivedReports.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{r.report_number || "—"}</TableCell>
                        <TableCell className="text-sm">{r.report_title_ar || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.report_date ? new Date(r.report_date).toLocaleDateString("ar-SA") : "—"}
                        </TableCell>
                        <TableCell>
                          {r.file_path ? (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                              onClick={async () => {
                                const { data } = await supabase.storage.from("archived-reports").createSignedUrl(r.file_path, 300);
                                if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                              }}>
                              <Download className="w-3 h-3" /> تحميل
                            </Button>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── INTERNAL NOTES ─── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-warning" />
              ملاحظات داخلية
              <span className="text-[10px] text-muted-foreground font-normal">(غير مرئية للعميل)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="أضف ملاحظة داخلية عن هذا العميل..."
              rows={3}
            />
            <Button size="sm" className="gap-1.5" onClick={handleSaveNote} disabled={savingNote}>
              {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ الملاحظة
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ─── EDIT DIALOG ─── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary" />
              تعديل بيانات العميل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">الاسم</label>
              <Input value={editForm.name_ar || ""} onChange={e => setEditForm(f => ({ ...f, name_ar: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">الجوال</label>
                <Input dir="ltr" value={editForm.phone || ""} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">البريد</label>
                <Input dir="ltr" value={editForm.email || ""} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">مسؤول التواصل</label>
              <Input value={editForm.contact_person_ar || ""} onChange={e => setEditForm(f => ({ ...f, contact_person_ar: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">المدينة</label>
                <Input value={editForm.city_ar || ""} onChange={e => setEditForm(f => ({ ...f, city_ar: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">السجل التجاري</label>
                <Input dir="ltr" value={editForm.cr_number || ""} onChange={e => setEditForm(f => ({ ...f, cr_number: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">العنوان</label>
              <Input value={editForm.address_ar || ""} onChange={e => setEditForm(f => ({ ...f, address_ar: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="gap-1">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
