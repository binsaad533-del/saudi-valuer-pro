import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { exportInvoicesPDF, exportInvoicesExcel, type InvoiceExportRow } from "@/lib/cfo-export";
import { formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  total_amount: number;
  payment_status: string;
  due_date: string | null;
  created_at: string;
  client_name: string;
}

const statusColors: Record<string, string> = {
  paid:      "bg-success/10 text-success border-success/20",
  pending:   "bg-warning/10 text-warning border-warning/20",
  overdue:   "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const statusLabels: Record<string, string> = {
  paid: "مدفوعة", pending: "معلقة", overdue: "متأخرة", cancelled: "ملغاة",
};

const ITEMS_PER_PAGE = 10;

export default function InvoicesTable() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, total_amount, payment_status, due_date, created_at, clients(name_ar)")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setInvoices(data.map((r: any) => ({
          id:             r.id,
          invoice_number: r.invoice_number,
          total_amount:   r.total_amount,
          payment_status: r.payment_status,
          due_date:       r.due_date,
          created_at:     r.created_at,
          client_name:    r.clients?.name_ar || "—",
        })));
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => invoices.filter(inv => {
    const matchSearch = !search ||
      (inv.client_name.includes(search)) ||
      (inv.invoice_number || "").includes(search);
    const matchStatus = statusFilter === "all" || inv.payment_status === statusFilter;
    return matchSearch && matchStatus;
  }), [invoices, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const exportRows: InvoiceExportRow[] = filtered.map(inv => ({
    invoice_number: inv.invoice_number,
    client_name:    inv.client_name,
    total_amount:   inv.total_amount,
    payment_status: inv.payment_status,
    due_date:       inv.due_date,
    created_at:     inv.created_at,
  }));

  return (
    <div className="bg-card rounded-lg border border-border shadow-card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">جدول الفواتير</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportInvoicesPDF(exportRows)} disabled={loading}>
            <FileText className="w-4 h-4 ml-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportInvoicesExcel(exportRows)} disabled={loading}>
            <FileSpreadsheet className="w-4 h-4 ml-1" /> Excel
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
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الفاتورة</TableHead>
                <TableHead>اسم العميل</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>تاريخ الاستحقاق</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm">{inv.invoice_number || "—"}</TableCell>
                  <TableCell>{inv.client_name}</TableCell>
                  <TableCell className="font-semibold">{formatNumber(inv.total_amount)} <SAR /></TableCell>
                  <TableCell>{inv.due_date || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[inv.payment_status] || ""}>
                      {statusLabels[inv.payment_status] || inv.payment_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    لا توجد فواتير
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
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
