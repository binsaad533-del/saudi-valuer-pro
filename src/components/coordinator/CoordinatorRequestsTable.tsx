import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Filter, RefreshCw, MoreHorizontal, Eye, UserCog, Flag } from "lucide-react";
import { STATUS_LABELS as WF_STATUS_LABELS, STATUS_COLORS } from "@/lib/workflow-engine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";


const STATUS_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(
  Object.entries(WF_STATUS_LABELS).map(([k, v]) => [k, { label: v.ar, color: STATUS_COLORS[k] || "bg-muted text-muted-foreground" }])
);

const REPORT_STATUS_MAP: Record<string, string> = {
  draft: "مسودة",
  under_client_review: "مراجعة العميل",
  draft_report_ready: "تقرير جاهز",
  revision_in_progress: "قيد التعديل",
  report_issued: "صادر",
  closed: "مغلق",
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "منخفضة", color: "bg-muted text-muted-foreground" },
  { value: "normal", label: "عادية", color: "bg-primary/10 text-primary" },
  { value: "high", label: "عالية", color: "bg-warning/10 text-warning" },
  { value: "urgent", label: "عاجلة", color: "bg-destructive/10 text-destructive" },
];

interface Props {
  requests: any[];
  clients: any[];
  onRefresh: () => void;
}

export default function CoordinatorRequestsTable({ requests, clients, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailDialog, setDetailDialog] = useState(false);
  const [reassignDialog, setReassignDialog] = useState(false);
  const [priorityDialog, setPriorityDialog] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [reassignNote, setReassignNote] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [saving, setSaving] = useState(false);

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name_ar]));

  const filtered = requests.filter(r => {
    const clientName = clientMap[r.client_id] || "";
    const matchSearch = !search ||
      clientName.includes(search) ||
      (r.reference_number || "").includes(search) ||
      (r.property_city_ar || "").includes(search);
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: string) => {
    const s = STATUS_MAP[status] || { label: status, color: "bg-muted text-muted-foreground" };
    return <Badge className={`${s.color} text-[10px]`}>{s.label}</Badge>;
  };

  const getPriorityBadge = (priority: string | null) => {
    const p = PRIORITY_OPTIONS.find(o => o.value === priority) || PRIORITY_OPTIONS[1];
    return <Badge className={`${p.color} text-[10px]`}>{p.label}</Badge>;
  };

  const getReportStatus = (status: string) => {
    return REPORT_STATUS_MAP[status] || "—";
  };

  const openDetail = (req: any) => {
    setSelectedReq(req);
    setDetailDialog(true);
  };

  const openReassign = (req: any) => {
    setSelectedReq(req);
    setReassignNote("");
    setReassignDialog(true);
  };

  const openPriority = (req: any) => {
    setSelectedReq(req);
    setNewPriority(req.priority || "normal");
    setPriorityDialog(true);
  };

  const handleReassign = async () => {
    if (!selectedReq || !reassignNote.trim()) {
      toast.error("يرجى كتابة سبب إعادة التعيين");
      return;
    }
    setSaving(true);
    try {
      await supabase.from("request_messages" as any).insert({
        request_id: selectedReq.id,
        sender_type: "system" as any,
        content: `طلب إعادة تعيين المقيّم بواسطة المنسق: ${reassignNote}`,
      });
      toast.success("تم إرسال طلب إعادة التعيين");
      setReassignDialog(false);
      onRefresh();
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  const handlePriorityChange = async () => {
    if (!selectedReq) return;
    setSaving(true);
    try {
      await supabase.from("valuation_requests" as any)
        .update({ priority: newPriority } as any)
        .eq("id", selectedReq.id);
      toast.success("تم تغيير الأولوية");
      setPriorityDialog(false);
      onRefresh();
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  const uniqueStatuses = [...new Set(requests.map(r => r.status))];

  return (
    <>
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">متابعة الطلبات والإجراءات</CardTitle>
            <Button size="sm" variant="outline" onClick={onRefresh}>
              <RefreshCw className="w-3.5 h-3.5 ml-1" />تحديث
            </Button>
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو الرقم المرجعي..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] text-sm">
                <Filter className="w-3.5 h-3.5 ml-1" />
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                {uniqueStatuses.map(s => (
                  <SelectItem key={s} value={s}>
                    {STATUS_MAP[s]?.label || s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم الطلب</TableHead>
                  <TableHead className="text-right">اسم العميل</TableHead>
                  <TableHead className="text-right">نوع التقييم</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">تاريخ الإدخال</TableHead>
                  <TableHead className="text-right">المقيّم</TableHead>
                  <TableHead className="text-right">التقرير</TableHead>
                  <TableHead className="text-right">الأولوية</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                      لا توجد طلبات مطابقة
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(req => (
                    <TableRow key={req.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs" dir="ltr">
                        {req.reference_number || "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {clientMap[req.client_id] || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{req.property_type || "—"}</TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(req.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {req.assigned_valuer_name || "لم يُعيَّن"}
                      </TableCell>
                      <TableCell className="text-sm">{getReportStatus(req.status)}</TableCell>
                      <TableCell>{getPriorityBadge(req.priority)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(req)}>
                              <Eye className="w-3.5 h-3.5 ml-2" />
                              عرض التفاصيل
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openReassign(req)}>
                              <UserCog className="w-3.5 h-3.5 ml-2" />
                              إعادة تعيين المقيّم
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPriority(req)}>
                              <Flag className="w-3.5 h-3.5 ml-2" />
                              تغيير الأولوية
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
            عرض {filtered.length} من {requests.length} طلب
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب</DialogTitle>
          </DialogHeader>
          {selectedReq && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">الرقم المرجعي:</span><br /><span className="font-mono" dir="ltr">{selectedReq.reference_number || "—"}</span></div>
                <div><span className="text-muted-foreground">العميل:</span><br />{clientMap[selectedReq.client_id] || "—"}</div>
                <div><span className="text-muted-foreground">نوع العقار:</span><br />{selectedReq.property_type || "—"}</div>
                <div><span className="text-muted-foreground">الغرض:</span><br />{selectedReq.purpose || "—"}</div>
                <div><span className="text-muted-foreground">المدينة:</span><br />{selectedReq.property_city_ar || "—"}</div>
                <div><span className="text-muted-foreground">الحي:</span><br />{selectedReq.property_district_ar || "—"}</div>
                <div><span className="text-muted-foreground">مساحة الأرض:</span><br />{selectedReq.land_area ? `${selectedReq.land_area} م²` : "—"}</div>
                <div><span className="text-muted-foreground">مساحة البناء:</span><br />{selectedReq.building_area ? `${selectedReq.building_area} م²` : "—"}</div>
                <div><span className="text-muted-foreground">الحالة:</span><br />{getStatusBadge(selectedReq.status)}</div>
                <div><span className="text-muted-foreground">المبلغ:</span><br />{selectedReq.quotation_amount ? `${formatNumber(Number(selectedReq.quotation_amount))} ر.س` : "—"}</div>
                <div><span className="text-muted-foreground">المقيّم:</span><br />{selectedReq.assigned_valuer_name || "لم يُعيَّن"}</div>
                <div><span className="text-muted-foreground">تاريخ الإدخال:</span><br />{formatDate(selectedReq.created_at)}</div>
              </div>
              {selectedReq.property_description_ar && (
                <div><span className="text-muted-foreground">الوصف:</span><br />{selectedReq.property_description_ar}</div>
              )}
              {selectedReq.notes && (
                <div><span className="text-muted-foreground">ملاحظات:</span><br />{selectedReq.notes}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={reassignDialog} onOpenChange={setReassignDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-4 h-4 text-primary" />
              إعادة تعيين المقيّم
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              طلب: <span className="font-mono text-foreground" dir="ltr">{selectedReq?.reference_number || "—"}</span>
            </p>
            <div className="space-y-1">
              <Label className="text-xs">سبب إعادة التعيين *</Label>
              <Textarea
                placeholder="اكتب السبب..."
                value={reassignNote}
                onChange={e => setReassignNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialog(false)}>إلغاء</Button>
            <Button onClick={handleReassign} disabled={saving}>
              إرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Priority Dialog */}
      <Dialog open={priorityDialog} onOpenChange={setPriorityDialog}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-warning" />
              تغيير الأولوية
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              طلب: <span className="font-mono text-foreground" dir="ltr">{selectedReq?.reference_number || "—"}</span>
            </p>
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger><SelectValue placeholder="اختر الأولوية" /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriorityDialog(false)}>إلغاء</Button>
            <Button onClick={handlePriorityChange} disabled={saving}>
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
