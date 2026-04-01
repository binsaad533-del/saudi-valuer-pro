import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, RefreshCw } from "lucide-react";
import { STATUS_LABELS as WF_STATUS_LABELS, STATUS_COLORS } from "@/lib/workflow-engine";

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

interface Props {
  requests: any[];
  clients: any[];
  onRefresh: () => void;
}

export default function CoordinatorRequestsTable({ requests, clients, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const getReportStatus = (status: string) => {
    const reportStatuses = ["draft_report_ready", "under_client_review", "revision_in_progress", "report_issued", "closed"];
    if (reportStatuses.includes(status)) {
      return REPORT_STATUS_MAP[status] || "—";
    }
    return "—";
  };

  const uniqueStatuses = [...new Set(requests.map(r => r.status))];

  return (
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
              placeholder="بحث بالاسم أو الرقم المرجعي أو المدينة..."
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
                <TableHead className="text-right">الحالة الحالية</TableHead>
                <TableHead className="text-right">تاريخ الإدخال</TableHead>
                <TableHead className="text-right">المقيّم المعين</TableHead>
                <TableHead className="text-right">حالة التقرير</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    لا توجد طلبات مطابقة
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(req => (
                  <TableRow key={req.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono text-xs" dir="ltr">
                      {req.reference_number || "—"}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {clientMap[req.client_id] || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {req.property_type || "—"}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(req.status)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString("ar-SA")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {req.assigned_valuer_name || "لم يُعيَّن"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getReportStatus(req.status)}
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
  );
}
