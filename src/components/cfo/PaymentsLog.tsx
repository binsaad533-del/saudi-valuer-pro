import { useState, useMemo } from "react";
import { payments, methodLabels } from "@/data/cfoMockData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet } from "lucide-react";
import { exportPaymentsPDF, exportPaymentsExcel } from "@/lib/cfo-export";

export default function PaymentsLog() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (dateFrom && p.date < dateFrom) return false;
      if (dateTo && p.date > dateTo) return false;
      return true;
    });
  }, [dateFrom, dateTo]);

  return (
    <div className="bg-card rounded-lg border border-border shadow-card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">تقرير المدفوعات</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportPaymentsPDF(filtered)}>
            <FileText className="w-4 h-4 ml-1" /> تصدير PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportPaymentsExcel(filtered)}>
            <FileSpreadsheet className="w-4 h-4 ml-1" /> تصدير Excel
          </Button>
        </div>
      </div>
      <div className="p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">من:</span>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">إلى:</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الدفعة</TableHead>
              <TableHead>رقم الفاتورة</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>طريقة الدفع</TableHead>
              <TableHead>التاريخ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.paymentNumber}</TableCell>
                <TableCell>{p.invoiceNumber}</TableCell>
                <TableCell>{p.clientName}</TableCell>
                <TableCell>{p.amount.toLocaleString("ar-SA")} ر.س</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-muted/50">{methodLabels[p.method]}</Badge>
                </TableCell>
                <TableCell>{p.date}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  لا توجد مدفوعات في الفترة المحددة
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
