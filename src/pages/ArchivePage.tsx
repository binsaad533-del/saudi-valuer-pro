import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  Archive, Upload, Search, FileText, Loader2, Sparkles, Trash2,
  Link2, CheckCircle, AlertTriangle, Eye, Download, UserPlus,
} from "lucide-react";

export default function ArchivePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [indexing, setIndexing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [linkDialog, setLinkDialog] = useState<any>(null);
  const [editDialog, setEditDialog] = useState<any>(null);
  const [clientSearch, setClientSearch] = useState("");

  // Fetch archived reports
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["archived-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("archived_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Archive fetch error:", error);
        return [];
      }
      return data || [];
    },
  });

  // Fetch clients for linking
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-link", clientSearch],
    queryFn: async () => {
      let q = supabase.from("clients").select("id, name_ar, email, phone").eq("is_active", true).limit(20);
      if (clientSearch) q = q.ilike("name_ar", `%${clientSearch}%`);
      const { data } = await q;
      return data || [];
    },
  });

  // Get org ID
  const getOrgId = async () => {
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    return data?.organization_id;
  };

  // Bulk upload handler
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !user) return;

    const orgId = await getOrgId();
    if (!orgId) { toast.error("لم يتم العثور على المنظمة"); return; }

    setUploading(true);
    let successCount = 0;

    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name}: الحد الأقصى 20 ميغابايت`);
        continue;
      }

      const ext = file.name.split(".").pop();
      const path = `${orgId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("archived-reports")
        .upload(path, file);

      if (uploadError) {
        toast.error(`فشل رفع: ${file.name}`);
        continue;
      }

      const { error: insertError } = await supabase
        .from("archived_reports")
        .insert({
          organization_id: orgId,
          uploaded_by: user.id,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
          report_title_ar: file.name.replace(/\.[^/.]+$/, ""),
        });

      if (insertError) {
        toast.error(`فشل حفظ: ${file.name}`);
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`تم رفع ${successCount} ملف بنجاح`);
      queryClient.invalidateQueries({ queryKey: ["archived-reports"] });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  // AI indexing
  const handleIndex = async (report: any) => {
    setIndexing(report.id);
    try {
      const { data, error } = await supabase.functions.invoke("extract-archive-metadata", {
        body: { archived_report_id: report.id, file_name: report.file_name },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("تم الفهرسة بنجاح بالذكاء الاصطناعي");
        queryClient.invalidateQueries({ queryKey: ["archived-reports"] });
      } else {
        toast.error("فشل الاستخراج التلقائي");
      }
    } catch {
      toast.error("خطأ في الفهرسة الذكية");
    }
    setIndexing(null);
  };

  // Link to client
  const handleLinkClient = async (reportId: string, clientId: string, clientName: string) => {
    const { error } = await supabase
      .from("archived_reports")
      .update({ client_id: clientId, client_name_ar: clientName })
      .eq("id", reportId);
    if (error) {
      toast.error("فشل الربط");
    } else {
      toast.success("تم ربط التقرير بالعميل");
      queryClient.invalidateQueries({ queryKey: ["archived-reports"] });
      setLinkDialog(null);
    }
  };

  // Delete report
  const handleDelete = async (report: any) => {
    if (!confirm("هل أنت متأكد من حذف هذا التقرير؟")) return;
    await supabase.storage.from("archived-reports").remove([report.file_path]);
    const { error } = await supabase.from("archived_reports").delete().eq("id", report.id);
    if (error) toast.error("فشل الحذف");
    else {
      toast.success("تم الحذف");
      queryClient.invalidateQueries({ queryKey: ["archived-reports"] });
    }
  };

  // Save manual edits
  const handleSaveEdit = async () => {
    if (!editDialog) return;
    const { id, ...updates } = editDialog;
    const { error } = await supabase.from("archived_reports").update(updates).eq("id", id);
    if (error) toast.error("فشل الحفظ");
    else {
      toast.success("تم الحفظ");
      queryClient.invalidateQueries({ queryKey: ["archived-reports"] });
      setEditDialog(null);
    }
  };

  // Download file
  const handleDownload = async (report: any) => {
    const { data } = await supabase.storage
      .from("archived-reports")
      .createSignedUrl(report.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("فشل التحميل");
  };

  // Filter
  const filtered = reports.filter((r: any) => {
    const matchSearch = !search ||
      r.file_name?.includes(search) ||
      r.report_title_ar?.includes(search) ||
      r.report_number?.includes(search) ||
      r.client_name_ar?.includes(search) ||
      r.property_city_ar?.includes(search);
    const matchType = typeFilter === "all" || r.report_type === typeFilter;
    return matchSearch && matchType;
  });

  const formatSize = (bytes: number) => {
    if (!bytes) return "-";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Archive className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">أرشيف التقارير</h1>
            <p className="text-sm text-muted-foreground">رفع وفهرسة التقارير السابقة وربطها بالعملاء</p>
          </div>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            className="hidden"
            onChange={handleUpload}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            رفع ملفات
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{reports.length}</p>
            <p className="text-xs text-muted-foreground">إجمالي الملفات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{reports.filter((r: any) => r.is_indexed).length}</p>
            <p className="text-xs text-muted-foreground">مفهرسة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-warning">{reports.filter((r: any) => !r.is_indexed).length}</p>
            <p className="text-xs text-muted-foreground">بانتظار الفهرسة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{reports.filter((r: any) => r.client_id).length}</p>
            <p className="text-xs text-muted-foreground">مربوطة بعملاء</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم، الرقم، العميل، المدينة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="نوع التقرير" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأنواع</SelectItem>
            <SelectItem value="real_estate">تقييم عقاري</SelectItem>
            <SelectItem value="land">أراضي</SelectItem>
            <SelectItem value="residential">سكني</SelectItem>
            <SelectItem value="commercial">تجاري</SelectItem>
            <SelectItem value="machinery">آلات ومعدات</SelectItem>
            <SelectItem value="other">أخرى</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="gap-2"
          disabled={!reports.some((r: any) => !r.is_indexed)}
          onClick={async () => {
            const unindexed = reports.filter((r: any) => !r.is_indexed);
            for (const r of unindexed) {
              await handleIndex(r);
            }
          }}
        >
          <Sparkles className="w-4 h-4" />
          فهرسة الكل بالذكاء الاصطناعي
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Archive className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>لا توجد تقارير مؤرشفة</p>
              <p className="text-xs mt-1">ابدأ برفع ملفات التقارير السابقة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الملف</TableHead>
                    <TableHead>العنوان / الرقم</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>المدينة</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm truncate max-w-[160px]">{r.file_name}</p>
                            <p className="text-xs text-muted-foreground">{formatSize(r.file_size)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{r.report_title_ar || "-"}</p>
                        {r.report_number && <p className="text-xs text-muted-foreground">{r.report_number}</p>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {r.report_type === "real_estate" ? "عقاري" :
                           r.report_type === "land" ? "أراضي" :
                           r.report_type === "residential" ? "سكني" :
                           r.report_type === "commercial" ? "تجاري" :
                           r.report_type === "machinery" ? "آلات" : r.report_type || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.property_city_ar || "-"}</TableCell>
                      <TableCell>
                        {r.client_name_ar ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-success" />
                            <span className="text-sm">{r.client_name_ar}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">غير مربوط</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.is_indexed ? (
                          <Badge className="bg-success/10 text-success border-success/20 text-xs">
                            مفهرس {r.ai_confidence ? `${Math.round(r.ai_confidence * 100)}%` : ""}
                          </Badge>
                        ) : indexing === r.id ? (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> جاري الفهرسة
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-warning">بانتظار</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(r)}>
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleIndex(r)} disabled={indexing === r.id}>
                            <Sparkles className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditDialog({ ...r })}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setLinkDialog(r); setClientSearch(""); }}>
                            <UserPlus className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Client Dialog */}
      <Dialog open={!!linkDialog} onOpenChange={() => setLinkDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              ربط التقرير بعميل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              التقرير: {linkDialog?.report_title_ar || linkDialog?.file_name}
            </p>
            <Input
              placeholder="بحث عن عميل..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {clients.map((c: any) => (
                <button
                  key={c.id}
                  className="w-full text-right p-2 rounded-lg hover:bg-muted text-sm flex justify-between items-center"
                  onClick={() => handleLinkClient(linkDialog.id, c.id, c.name_ar)}
                >
                  <span className="text-xs text-muted-foreground">{c.email}</span>
                  <span>{c.name_ar}</span>
                </button>
              ))}
              {clients.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-4">لا توجد نتائج</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit/View Dialog */}
      <Dialog open={!!editDialog} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تعديل بيانات التقرير</DialogTitle>
          </DialogHeader>
          {editDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">عنوان التقرير</Label>
                  <Input
                    value={editDialog.report_title_ar || ""}
                    onChange={(e) => setEditDialog({ ...editDialog, report_title_ar: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">رقم التقرير</Label>
                  <Input
                    value={editDialog.report_number || ""}
                    onChange={(e) => setEditDialog({ ...editDialog, report_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">نوع التقرير</Label>
                  <Select value={editDialog.report_type || "real_estate"} onValueChange={(v) => setEditDialog({ ...editDialog, report_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="real_estate">عقاري</SelectItem>
                      <SelectItem value="land">أراضي</SelectItem>
                      <SelectItem value="residential">سكني</SelectItem>
                      <SelectItem value="commercial">تجاري</SelectItem>
                      <SelectItem value="machinery">آلات ومعدات</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">تاريخ التقرير</Label>
                  <Input
                    type="date"
                    dir="ltr"
                    value={editDialog.report_date || ""}
                    onChange={(e) => setEditDialog({ ...editDialog, report_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">نوع العقار</Label>
                  <Input
                    value={editDialog.property_type || ""}
                    onChange={(e) => setEditDialog({ ...editDialog, property_type: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">المدينة</Label>
                  <Input
                    value={editDialog.property_city_ar || ""}
                    onChange={(e) => setEditDialog({ ...editDialog, property_city_ar: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الحي</Label>
                  <Input
                    value={editDialog.property_district_ar || ""}
                    onChange={(e) => setEditDialog({ ...editDialog, property_district_ar: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">اسم العميل</Label>
                  <Input
                    value={editDialog.client_name_ar || ""}
                    onChange={(e) => setEditDialog({ ...editDialog, client_name_ar: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ملاحظات</Label>
                <Input
                  value={editDialog.notes || ""}
                  onChange={(e) => setEditDialog({ ...editDialog, notes: e.target.value })}
                />
              </div>
              {editDialog.ai_confidence > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  ثقة الذكاء الاصطناعي: {Math.round(editDialog.ai_confidence * 100)}%
                  {editDialog.ai_confidence < 0.8 && (
                    <span className="flex items-center gap-1 text-warning">
                      <AlertTriangle className="w-3 h-3" /> يُنصح بالمراجعة
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">إلغاء</Button>
            </DialogClose>
            <Button onClick={handleSaveEdit} className="gap-2">
              <CheckCircle className="w-4 h-4" /> حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
