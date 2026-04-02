import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Search, Filter, Eye, Download, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { exportReportToPDF, downloadPdfBlob } from "@/services/pdfExportService";
import { mockReports } from "@/data/mockReports";
import { getStatusLabel, getStatusColor } from "@/utils/reportWorkflow";
import type { ReportStatus } from "@/types/report";
import { formatDate, formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";


const ASSET_TYPE_LABELS: Record<string, string> = {
  real_estate: "عقار",
  equipment: "معدات",
  vehicle: "مركبة",
};

const STATUSES: ReportStatus[] = ["draft", "review", "approved", "issued", "delivered", "cancelled"];

export default function ReportsListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleDownloadPdf = useCallback(async (report: typeof mockReports[0]) => {
    setExportingId(report.id);
    try {
      const blob = await exportReportToPDF(report);
      downloadPdfBlob(blob, `${report.reportNumber}.pdf`);
      toast({ title: "تم تحميل التقرير بنجاح" });
    } catch (e: any) {
      toast({ title: "فشل التحميل", description: e.message, variant: "destructive" });
    } finally {
      setExportingId(null);
    }
  }, [toast]);

  const filtered = useMemo(() => {
    return mockReports.filter((r) => {
      const matchSearch =
        !search ||
        r.reportNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.clientName.includes(search);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

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
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
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
              <TableHead className="text-right">نوع الأصل</TableHead>
              <TableHead className="text-right">القيمة التقديرية</TableHead>
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
              filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/reports/generate/${r.id}`)}
                >
                  <TableCell className="font-mono text-sm font-medium">{r.reportNumber}</TableCell>
                  <TableCell>{r.clientName}</TableCell>
                  <TableCell>{ASSET_TYPE_LABELS[r.assetType] || r.assetType}</TableCell>
                  <TableCell className="font-medium">
                    {formatNumber(r.estimatedValue)} ر.س
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(r.status)}>{getStatusLabel(r.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/reports/generate/${r.id}`)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {(r.status === "issued" || r.status === "delivered") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={exportingId === r.id}
                          onClick={() => handleDownloadPdf(r)}
                        >
                          {exportingId === r.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
