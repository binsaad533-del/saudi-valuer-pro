import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { exportPaymentsPDF, exportPaymentsExcel, type PaymentExportRow } from "@/lib/cfo-export";
import { formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";

interface ReceiptRow {
  id: string;
  amount: number;
  payment_type: string | null;
  status: string | null;
  created_at: string;
  reference_number: string | null;
}

const typeLabels: Record<string, string> = {
  first:  "الدفعة الأولى 50%",
  final:  "الدفعة النهائية 50%",
  second: "الدفعة النهائية 50%",
};

const statusColors: Record<string, string> = {
  approved: "bg-success/10 text-success border-success/20",
  pending:  "bg-warning/10 text-warning border-warning/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusLabels: Record<string, string> = {
  approved: "معتمد", pending: "بانتظار المراجعة", rejected: "مرفوض",
};

export default function PaymentsLog() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("payment_receipts" as any)
        .select("id, amount, payment_type, status, created_at, valuation_requests(reference_number)")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setReceipts((data as any[]).map(r => ({
          id:               r.id,
          amount:           r.amount,
          payment_type:     r.payment_type,
          status:           r.status,
          created_at:       r.created_at,
          reference_number: r.valuation_requests?.reference_number || null,
        })));
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => receipts.filter(r => {
    const dateStr = r.created_at.slice(0, 10);
    if (dateFrom && dateStr < dateFrom) return false;
    if (dateTo   && dateStr > dateTo)   return false;
    return true;
  }), [receipts, dateFrom, dateTo]);

  const exportRows: PaymentExportRow[] = filtered.map(r => ({
    id:               r.id,
    amount:           r.amount,
    payment_type:     r.payment_type,
    status:           r.status,
    created_at:       r.created_at,
    reference_number: r.reference_number,
  }));

  return (
    <div className="bg-card rounded-lg border border-border shadow-card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">سجل إيصالات الدفع</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportPaymentsPDF(exportRows)} disabled={loading}>
            <FileText className="w-4 h-4 ml-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportPaymentsExcel(exportRows)} disabled={loading}>
            <FileSpreadsheet className="w-4 h-4 ml-1" /> Excel
          </Button>
        </div>
      </div>

      <div className="p-4 flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4 border-b border-border/50">
        <div className="w-full lg:w-[220px] space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground block">من</label>
          <Input type="date" lang="en" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="w-full h-11 text-left [direction:ltr] tracking-[0.02em]" dir="ltr" />
        </div>
        <div className="w-full lg:w-[220px] space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground block">إلى</label>
          <Input type="date" lang="en" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="w-full h-11 text-left [direction:ltr] tracking-[0.02em]" dir="ltr" />
        </div>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الطلب</TableHead>
                <TableHead>نوع الدفعة</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تاريخ الرفع</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.reference_number || r.id.slice(0, 8)}</TableCell>
                  <TableCell>{typeLabels[r.payment_type || ""] || (r.payment_type || "—")}</TableCell>
                  <TableCell className="font-semibold">{formatNumber(r.amount)} <SAR /></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[r.status || ""] || ""}>
                      {statusLabels[r.status || ""] || r.status || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.created_at.slice(0, 10)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    لا توجد إيصالات في الفترة المحددة
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
