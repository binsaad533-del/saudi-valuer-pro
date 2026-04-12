import jsPDF from "jspdf";
import { formatNumber } from "@/lib/utils";

// Generic CSV export
function exportCSV(headers: string[], rows: string[][], filename: string) {
  const bom = "\uFEFF";
  const csv = bom + [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Generic PDF export (table)
function exportPDF(title: string, headers: string[], rows: string[][], filename: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFont("helvetica");
  doc.setFontSize(14);
  doc.text(title, 14, 18);

  const startY = 28;
  const cellH = 8;
  const colW = (doc.internal.pageSize.getWidth() - 28) / headers.length;

  doc.setFontSize(8);
  doc.setFillColor(240, 240, 240);
  doc.rect(14, startY, colW * headers.length, cellH, "F");
  headers.forEach((h, i) => { doc.text(h, 14 + i * colW + 2, startY + 5.5); });

  doc.setFontSize(7);
  rows.forEach((row, ri) => {
    const y = startY + cellH * (ri + 1);
    if (y > doc.internal.pageSize.getHeight() - 15) doc.addPage();
    const currentY = y > doc.internal.pageSize.getHeight() - 15 ? 20 : y;
    row.forEach((cell, ci) => { doc.text(String(cell), 14 + ci * colW + 2, currentY + 5.5); });
  });

  doc.save(filename);
}

// ── Invoice export ────────────────────────────────────────────────────────────
export interface InvoiceExportRow {
  invoice_number: string | null;
  client_name: string;
  total_amount: number;
  payment_status: string;
  due_date: string | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  paid: "مدفوعة",
  pending: "معلقة",
  overdue: "متأخرة",
  cancelled: "ملغاة",
};

const invoiceHeaders = ["Invoice #", "Client", "Amount (SAR)", "Due Date", "Status"];

function invoiceToRow(inv: InvoiceExportRow): string[] {
  return [
    inv.invoice_number || "—",
    inv.client_name,
    formatNumber(inv.total_amount),
    inv.due_date || "—",
    statusLabels[inv.payment_status] || inv.payment_status,
  ];
}

export function exportInvoicesPDF(data: InvoiceExportRow[]) {
  exportPDF("Invoices Report", invoiceHeaders, data.map(invoiceToRow), "invoices.pdf");
}

export function exportInvoicesExcel(data: InvoiceExportRow[]) {
  exportCSV(invoiceHeaders, data.map(invoiceToRow), "invoices.csv");
}

// ── Payment export ────────────────────────────────────────────────────────────
export interface PaymentExportRow {
  id: string;
  amount: number;
  payment_type: string | null;
  status: string | null;
  created_at: string;
  reference_number?: string | null;
}

const paymentTypeLabels: Record<string, string> = {
  first: "الدفعة الأولى",
  final: "الدفعة النهائية",
  second: "الدفعة الثانية",
};

const paymentStatusLabels: Record<string, string> = {
  pending: "بانتظار المراجعة",
  approved: "معتمدة",
  rejected: "مرفوضة",
};

const paymentHeaders = ["Ref #", "Type", "Amount (SAR)", "Status", "Date"];

function paymentToRow(p: PaymentExportRow): string[] {
  return [
    p.reference_number || p.id.slice(0, 8),
    paymentTypeLabels[p.payment_type || ""] || (p.payment_type || "—"),
    formatNumber(p.amount),
    paymentStatusLabels[p.status || ""] || (p.status || "—"),
    p.created_at.slice(0, 10),
  ];
}

export function exportPaymentsPDF(data: PaymentExportRow[]) {
  exportPDF("Payments Report", paymentHeaders, data.map(paymentToRow), "payments.pdf");
}

export function exportPaymentsExcel(data: PaymentExportRow[]) {
  exportCSV(paymentHeaders, data.map(paymentToRow), "payments.csv");
}
