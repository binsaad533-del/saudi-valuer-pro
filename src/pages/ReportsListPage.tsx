import { useState, useMemo } from "react";
import { FileText, Search, Filter, Eye, Download, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ReportStatus = "draft" | "review" | "approved" | "delivered" | "rejected";

interface Report {
  id: string;
  reportNumber: string;
  clientName: string;
  valuationType: string;
  status: ReportStatus;
  date: string;
  valuer: string;
}

const STATUS_MAP: Record<ReportStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "مسودة", variant: "secondary" },
  review: { label: "قيد المراجعة", variant: "outline" },
  approved: { label: "معتمد", variant: "default" },
  delivered: { label: "تم التسليم", variant: "default" },
  rejected: { label: "مرفوض", variant: "destructive" },
};

const VALUATION_TYPES = ["سكني", "تجاري", "أرض", "صناعي", "زراعي"];

const MOCK_REPORTS: Report[] = [
  { id: "1", reportNumber: "RPT-2026-0001", clientName: "شركة الرياض للتطوير", valuationType: "تجاري", status: "approved", date: "2026-03-28", valuer: "أحمد محمد" },
  { id: "2", reportNumber: "RPT-2026-0002", clientName: "مؤسسة النور", valuationType: "سكني", status: "delivered", date: "2026-03-27", valuer: "خالد العتيبي" },
  { id: "3", reportNumber: "RPT-2026-0003", clientName: "عبدالله سعود الشمري", valuationType: "أرض", status: "draft", date: "2026-03-26", valuer: "أحمد محمد" },
  { id: "4", reportNumber: "RPT-2026-0004", clientName: "شركة جدة القابضة", valuationType: "تجاري", status: "review", date: "2026-03-25", valuer: "سارة الحربي" },
  { id: "5", reportNumber: "RPT-2026-0005", clientName: "فهد العنزي", valuationType: "سكني", status: "rejected", date: "2026-03-24", valuer: "خالد العتيبي" },
  { id: "6", reportNumber: "RPT-2026-0006", clientName: "مجموعة الدمام التجارية", valuationType: "صناعي", status: "approved", date: "2026-03-23", valuer: "سارة الحربي" },
  { id: "7", reportNumber: "RPT-2026-0007", clientName: "سلطان الدوسري", valuationType: "أرض", status: "draft", date: "2026-03-22", valuer: "أحمد محمد" },
  { id: "8", reportNumber: "RPT-2026-0008", clientName: "شركة المدينة العقارية", valuationType: "سكني", status: "review", date: "2026-03-21", valuer: "خالد العتيبي" },
  { id: "9", reportNumber: "RPT-2026-0009", clientName: "مصنع الخليج", valuationType: "صناعي", status: "delivered", date: "2026-03-20", valuer: "سارة الحربي" },
  { id: "10", reportNumber: "RPT-2026-0010", clientName: "نواف القحطاني", valuationType: "زراعي", status: "approved", date: "2026-03-19", valuer: "أحمد محمد" },
];

export default function ReportsListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return MOCK_REPORTS.filter((r) => {
      const matchSearch =
        !search ||
        r.reportNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.clientName.includes(search);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchType = typeFilter === "all" || r.valuationType === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [search, statusFilter, typeFilter]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">قائمة التقارير</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} تقرير</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث برقم التقرير أو اسم العميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="w-4 h-4 ml-2 text-muted-foreground" />
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {Object.entries(STATUS_MAP).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="نوع التقييم" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأنواع</SelectItem>
            {VALUATION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">رقم التقرير</TableHead>
              <TableHead className="text-right">العميل</TableHead>
              <TableHead className="text-right">نوع التقييم</TableHead>
              <TableHead className="text-right">المقيّم</TableHead>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-center">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  لا توجد تقارير مطابقة
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const st = STATUS_MAP[r.status];
                return (
                  <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-sm font-medium">{r.reportNumber}</TableCell>
                    <TableCell>{r.clientName}</TableCell>
                    <TableCell>{r.valuationType}</TableCell>
                    <TableCell className="text-muted-foreground">{r.valuer}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.date}</TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
