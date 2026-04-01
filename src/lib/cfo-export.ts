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

  // Header
  doc.setFontSize(8);
  doc.setFillColor(240, 240, 240);
  doc.rect(14, startY, colW * headers.length, cellH, "F");
  headers.forEach((h, i) => {
    doc.text(h, 14 + i * colW + 2, startY + 5.5);
  });

  // Rows
  doc.setFontSize(7);
  rows.forEach((row, ri) => {
    const y = startY + cellH * (ri + 1);
    if (y > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
    }
    const currentY = y > doc.internal.pageSize.getHeight() - 15 ? 20 : y;
    row.forEach((cell, ci) => {
      doc.text(String(cell), 14 + ci * colW + 2, currentY + 5.5);
    });
  });

  doc.save(filename);
}

// Invoices
import type { Invoice } from "@/data/cfoMockData";
import { formatNumber } from "@/lib/utils";
import { statusLabels } from "@/data/cfoMockData";

const invoiceHeaders = ["Invoice #", "Client", "Type", "Amount (SAR)", "Issue Date", "Due Date", "Status"];

function invoiceToRow(inv: Invoice): string[] {
  return [inv.invoiceNumber, inv.clientName, inv.valuationType, formatNumber(inv.amount), inv.issueDate, inv.dueDate, statusLabels[inv.status]];
}

export function exportInvoicesPDF(data: Invoice[]) {
  exportPDF("Invoices Report", invoiceHeaders, data.map(invoiceToRow), "invoices.pdf");
}

export function exportInvoicesExcel(data: Invoice[]) {
  exportCSV(invoiceHeaders, data.map(invoiceToRow), "invoices.csv");
}

// Payments
import type { Payment } from "@/data/cfoMockData";
import { methodLabels } from "@/data/cfoMockData";

const paymentHeaders = ["Payment #", "Invoice #", "Client", "Amount (SAR)", "Method", "Date"];

function paymentToRow(p: Payment): string[] {
  return [p.paymentNumber, p.invoiceNumber, p.clientName, formatNumber(p.amount), methodLabels[p.method], p.date];
}

export function exportPaymentsPDF(data: Payment[]) {
  exportPDF("Payments Report", paymentHeaders, data.map(paymentToRow), "payments.pdf");
}

export function exportPaymentsExcel(data: Payment[]) {
  exportCSV(paymentHeaders, data.map(paymentToRow), "payments.csv");
}
