import { useState, useMemo } from "react";
import { invoices, statusLabels, type Invoice } from "@/data/cfoMockData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, FileText, FileSpreadsheet } from "lucide-react";
import { exportInvoicesPDF, exportInvoicesExcel } from "@/lib/cfo-export";
import { formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";


const statusColors: Record<Invoice["status"], string> = {
  paid: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const ITEMS_PER_PAGE = 5;

export default function InvoicesTable() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const matchSearch = !search || inv.clientName.includes(search) || inv.invoiceNumber.includes(search);
      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="bg-card rounded-lg border border-border shadow-card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">جدول الفواتير</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportInvoicesPDF(filtered)}>
            <FileText className="w-4 h-4 ml-1" /> تصدير PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportInvoicesExcel(filtered)}>
            <FileSpreadsheet className="w-4 h-4 ml-1" /> تصدير Excel
          </Button>
        </div>
      </div>
      <div className="p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو رقم الفاتورة..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pr-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground"
        >
          <option value="all">جميع الحالات</option>
          <option value="paid">مدفوعة</option>
          <option value="pending">معلقة</option>
          <option value="overdue">متأخرة</option>
          <option value="cancelled">ملغاة</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الفاتورة</TableHead>
              <TableHead>اسم العميل</TableHead>
              <TableHead>نوع التقييم</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>تاريخ الإصدار</TableHead>
              <TableHead>تاريخ الاستحقاق</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                <TableCell>{inv.clientName}</TableCell>
                <TableCell>{inv.valuationType}</TableCell>
                <TableCell>{formatNumber(inv.amount)} <SAR /></TableCell>
                <TableCell>{inv.issueDate}</TableCell>
                <TableCell>{inv.dueDate}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[inv.status]}>
                    {statusLabels[inv.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  لا توجد نتائج
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-8 h-8 rounded-md text-sm ${page === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
