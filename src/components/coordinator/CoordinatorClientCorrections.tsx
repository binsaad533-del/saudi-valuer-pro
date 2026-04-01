import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Edit3, Loader2, Search, Save, AlertTriangle, FileX, MapPinOff, FileQuestion, MessageSquare, Send, History, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  requests: any[];
  onRefresh: () => void;
}

type IssueType = "missing_data" | "wrong_address" | "missing_docs";

const ISSUE_LABELS: Record<IssueType, { label: string; icon: typeof AlertTriangle; color: string }> = {
  missing_data: { label: "بيانات ناقصة", icon: FileX, color: "bg-warning/10 text-warning" },
  wrong_address: { label: "عنوان خاطئ", icon: MapPinOff, color: "bg-destructive/10 text-destructive" },
  missing_docs: { label: "مستندات مفقودة", icon: FileQuestion, color: "bg-primary/10 text-primary" },
};

function detectIssues(req: any): IssueType[] {
  const issues: IssueType[] = [];
  // Missing data
  if (!req.property_type || !req.purpose || !req.land_area) {
    issues.push("missing_data");
  }
  // Wrong/missing address
  if (!req.property_city_ar || !req.property_district_ar) {
    issues.push("wrong_address");
  }
  // Missing docs (status indicates awaiting info)
  if (req.status === "awaiting_client_info" || req.status === "client_comments") {
    issues.push("missing_docs");
  }
  return issues;
}

function describeIssues(req: any): string {
  const parts: string[] = [];
  if (!req.property_type || !req.purpose || !req.land_area) {
    const missing: string[] = [];
    if (!req.property_type) missing.push("نوع العقار");
    if (!req.purpose) missing.push("الغرض");
    if (!req.land_area) missing.push("المساحة");
    parts.push(`بيانات ناقصة: ${missing.join("، ")}`);
  }
  if (!req.property_city_ar) parts.push("المدينة غير محددة");
  if (!req.property_district_ar) parts.push("الحي غير محدد");
  if (req.status === "awaiting_client_info") parts.push("بانتظار مستندات من العميل");
  if (req.status === "client_comments") parts.push("العميل أرسل ملاحظات");
  return parts.join(" • ") || "—";
}

export default function CoordinatorClientCorrections({ requests, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [correctionLogs, setCorrectionLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    loadCorrectionLogs();
  }, []);

  const loadCorrectionLogs = async () => {
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .in("table_name", ["valuation_requests", "request_messages"])
      .order("created_at", { ascending: false })
      .limit(50);
    setCorrectionLogs(data || []);
    setLogsLoading(false);
  };
  const [issueFilter, setIssueFilter] = useState<"all" | IssueType>("all");
  const [editDialog, setEditDialog] = useState(false);
  const [messageDialog, setMessageDialog] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [clientMessage, setClientMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    cityAr: "",
    districtAr: "",
    landArea: "",
    buildingArea: "",
    descriptionAr: "",
    correctionNote: "",
  });

  // Only show requests with detected issues (not completed)
  const requestsWithIssues = requests
    .filter(r => !["completed", "closed", "report_issued"].includes(r.status))
    .map(r => ({ ...r, _issues: detectIssues(r) }))
    .filter(r => r._issues.length > 0);

  const filtered = requestsWithIssues.filter(r => {
    const matchSearch = !search ||
      (r.property_description_ar || "").includes(search) ||
      (r.reference_number || "").includes(search);
    const matchIssue = issueFilter === "all" || r._issues.includes(issueFilter);
    return matchSearch && matchIssue;
  });

  const issueCounts = {
    missing_data: requestsWithIssues.filter(r => r._issues.includes("missing_data")).length,
    wrong_address: requestsWithIssues.filter(r => r._issues.includes("wrong_address")).length,
    missing_docs: requestsWithIssues.filter(r => r._issues.includes("missing_docs")).length,
  };

  const openEdit = (req: any) => {
    setSelectedReq(req);
    setEditForm({
      cityAr: req.property_city_ar || "",
      districtAr: req.property_district_ar || "",
      landArea: req.land_area?.toString() || "",
      buildingArea: req.building_area?.toString() || "",
      descriptionAr: req.property_description_ar || "",
      correctionNote: "",
    });
    setEditDialog(true);
  };

  const handleSave = async () => {
    if (!selectedReq || !editForm.correctionNote.trim()) {
      toast.error("يرجى كتابة سبب التصحيح");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("valuation_requests" as any).update({
        property_city_ar: editForm.cityAr || null,
        property_district_ar: editForm.districtAr || null,
        land_area: editForm.landArea ? parseFloat(editForm.landArea) : null,
        building_area: editForm.buildingArea ? parseFloat(editForm.buildingArea) : null,
        property_description_ar: editForm.descriptionAr || null,
      } as any).eq("id", selectedReq.id);

      if (error) throw error;

      await supabase.from("request_messages" as any).insert({
        request_id: selectedReq.id,
        sender_type: "system" as any,
        content: `تصحيح بيانات بواسطة المنسق: ${editForm.correctionNote}`,
      });

      toast.success("تم تصحيح البيانات بنجاح");
      setEditDialog(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            تصحيح إجراءات العملاء
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            الطلبات التي تحتوي على أخطاء أو بيانات ناقصة تحتاج تدخل المنسق
          </p>

          {/* Issue Summary Chips */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Button
              size="sm"
              variant={issueFilter === "all" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setIssueFilter("all")}
            >
              الكل ({requestsWithIssues.length})
            </Button>
            {(Object.entries(ISSUE_LABELS) as [IssueType, typeof ISSUE_LABELS[IssueType]][]).map(([key, val]) => {
              const Icon = val.icon;
              return (
                <Button
                  key={key}
                  size="sm"
                  variant={issueFilter === key ? "default" : "outline"}
                  className="h-7 text-xs gap-1"
                  onClick={() => setIssueFilter(key)}
                >
                  <Icon className="w-3 h-3" />
                  {val.label} ({issueCounts[key]})
                </Button>
              );
            })}
          </div>

          <div className="relative mt-3">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالرقم المرجعي أو الوصف..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-9 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الرقم المرجعي</TableHead>
                  <TableHead className="text-right">وصف المشكلة</TableHead>
                  <TableHead className="text-right">نوع المشكلة</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                      لا توجد طلبات تحتاج تصحيح 🎉
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.slice(0, 30).map(req => (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono text-xs" dir="ltr">{req.reference_number || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[280px]">
                        {describeIssues(req)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {req._issues.map((issue: IssueType) => {
                            const info = ISSUE_LABELS[issue];
                            return (
                              <Badge key={issue} className={`${info.color} text-[10px]`}>
                                {info.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => openEdit(req)}>
                            <Edit3 className="w-3 h-3 ml-1" />تصحيح
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setSelectedReq(req); setClientMessage(""); setMessageDialog(true); }}>
                            <MessageSquare className="w-3 h-3 ml-1" />مراسلة العميل
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تصحيح بيانات الطلب</DialogTitle>
          </DialogHeader>
          {selectedReq && (
            <div className="mb-2">
              <div className="flex flex-wrap gap-1">
                {selectedReq._issues?.map((issue: IssueType) => {
                  const info = ISSUE_LABELS[issue];
                  return <Badge key={issue} className={`${info.color} text-[10px]`}>{info.label}</Badge>;
                })}
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">المدينة</Label>
                <Input value={editForm.cityAr} onChange={e => setEditForm(p => ({ ...p, cityAr: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الحي</Label>
                <Input value={editForm.districtAr} onChange={e => setEditForm(p => ({ ...p, districtAr: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">مساحة الأرض</Label>
                <Input type="number" value={editForm.landArea} onChange={e => setEditForm(p => ({ ...p, landArea: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">مساحة البناء</Label>
                <Input type="number" value={editForm.buildingArea} onChange={e => setEditForm(p => ({ ...p, buildingArea: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الوصف</Label>
              <Textarea value={editForm.descriptionAr} onChange={e => setEditForm(p => ({ ...p, descriptionAr: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-destructive">سبب التصحيح *</Label>
              <Textarea
                placeholder="اكتب سبب التعديل للتوثيق..."
                value={editForm.correctionNote}
                onChange={e => setEditForm(p => ({ ...p, correctionNote: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Save className="w-4 h-4 ml-1" />}
              حفظ التصحيح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Client Dialog */}
      <Dialog open={messageDialog} onOpenChange={setMessageDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              مراسلة العميل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              طلب: <span className="font-mono text-foreground" dir="ltr">{selectedReq?.reference_number || "—"}</span>
            </p>
            {selectedReq && (
              <div className="p-2 rounded-md bg-warning/10 text-xs text-warning">
                {describeIssues(selectedReq)}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">نص الرسالة للعميل *</Label>
              <Textarea
                placeholder="مثال: نرجو تزويدنا بصك الملكية ومخطط الموقع..."
                value={clientMessage}
                onChange={e => setClientMessage(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialog(false)}>إلغاء</Button>
            <Button
              disabled={saving || !clientMessage.trim()}
              onClick={async () => {
                if (!selectedReq || !clientMessage.trim()) return;
                setSaving(true);
                try {
                  await supabase.from("request_messages" as any).insert({
                    request_id: selectedReq.id,
                    sender_type: "admin" as any,
                    content: clientMessage.trim(),
                  });
                  toast.success("تم إرسال الرسالة للعميل");
                  setMessageDialog(false);
                } catch {
                  toast.error("حدث خطأ أثناء الإرسال");
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Send className="w-4 h-4 ml-1" />
              إرسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
