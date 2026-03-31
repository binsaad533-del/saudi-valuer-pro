import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Report } from "@/types/report";
import { getStatusLabel } from "@/utils/reportWorkflow";

const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PRIMARY_COLOR: [number, number, number] = [15, 82, 135];
const DARK: [number, number, number] = [30, 30, 30];
const GRAY: [number, number, number] = [120, 120, 120];
const LIGHT_BG: [number, number, number] = [245, 247, 250];

function addPageNumber(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`${i} / ${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: "center" });
  }
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(MARGIN, y, CONTENT_WIDTH, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(title, PAGE_WIDTH - MARGIN - 4, y + 5.5, { align: "right" });
  doc.setTextColor(...DARK);
  return y + 12;
}

function drawKeyValue(doc: jsPDF, key: string, value: string, y: number): number {
  if (y > PAGE_HEIGHT - 30) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(key, PAGE_WIDTH - MARGIN - 4, y, { align: "right" });
  doc.setTextColor(...DARK);
  doc.setFontSize(10);

  const lines = doc.splitTextToSize(value || "—", CONTENT_WIDTH - 10);
  doc.text(lines, PAGE_WIDTH - MARGIN - 4, y + 5, { align: "right" });
  return y + 5 + lines.length * 5 + 3;
}

function drawTableRow(doc: jsPDF, cells: string[], y: number, isHeader: boolean, colWidths: number[]): number {
  if (y > PAGE_HEIGHT - 25) {
    doc.addPage();
    y = MARGIN;
  }

  if (isHeader) {
    doc.setFillColor(...PRIMARY_COLOR);
    doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
  } else {
    if (Math.floor((y - MARGIN) / 7) % 2 === 0) {
      doc.setFillColor(...LIGHT_BG);
      doc.rect(MARGIN, y - 4, CONTENT_WIDTH, 7, "F");
    }
    doc.setTextColor(...DARK);
    doc.setFontSize(8);
  }

  let x = PAGE_WIDTH - MARGIN;
  cells.forEach((cell, i) => {
    doc.text(cell, x - 2, y, { align: "right" });
    x -= colWidths[i];
  });

  return y + 7;
}

export async function exportReportToPDF(report: Report): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // === COVER PAGE ===
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, PAGE_WIDTH, 80, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("تقرير تقييم", PAGE_WIDTH / 2, 30, { align: "center" });
  doc.setFontSize(14);
  doc.text("Valuation Report", PAGE_WIDTH / 2, 40, { align: "center" });

  doc.setFontSize(10);
  doc.text(report.reportNumber, PAGE_WIDTH / 2, 55, { align: "center" });
  doc.text(new Date(report.createdAt).toLocaleDateString("ar-SA"), PAGE_WIDTH / 2, 62, { align: "center" });

  // Status badge
  const statusLabel = getStatusLabel(report.status);
  doc.setFontSize(9);
  doc.text(`الحالة: ${statusLabel}`, PAGE_WIDTH / 2, 72, { align: "center" });

  // Draft watermark
  const isDraft = report.status === "draft" || report.status === "review";
  if (isDraft) {
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(60);
    doc.text("مسودة", PAGE_WIDTH / 2, PAGE_HEIGHT / 2, {
      align: "center",
      angle: 45,
    });
    doc.setTextColor(...DARK);
  }

  // Client info on cover
  let y = 100;
  doc.setTextColor(...DARK);
  doc.setFontSize(10);

  y = drawKeyValue(doc, "العميل", report.clientName, y);
  y = drawKeyValue(doc, "نوع الأصل", report.assetType === "real_estate" ? "عقار" : report.assetType === "equipment" ? "معدات" : "مركبة", y);
  y = drawKeyValue(doc, "الموقع", report.assetLocation, y);

  // === PAGE 2: Details ===
  doc.addPage();
  y = MARGIN;

  y = drawSectionTitle(doc, "وصف الأصل", y);
  y = drawKeyValue(doc, "الوصف", report.assetDescription, y);
  y += 3;

  y = drawSectionTitle(doc, "منهجية التقييم", y);
  const methodMap: Record<string, string> = {
    market_comparison: "أسلوب المقارنة بالسوق",
    income: "أسلوب الدخل",
    cost: "أسلوب التكلفة",
    combined: "أسلوب مشترك",
  };
  y = drawKeyValue(doc, "الأسلوب المستخدم", methodMap[report.methodology] || report.methodology, y);
  y += 3;

  y = drawSectionTitle(doc, "تحليل السوق", y);
  y = drawKeyValue(doc, "التحليل", report.marketAnalysis, y);
  y += 3;

  // === Comparables Table ===
  y = drawSectionTitle(doc, "المقارنات السوقية", y);
  const colWidths = [15, 55, 35, 40, 25];
  y = drawTableRow(doc, ["#", "الوصف", "القيمة (ر.س)", "المصدر", "التاريخ"], y, true, colWidths);

  report.comparables.forEach((c, i) => {
    y = drawTableRow(
      doc,
      [
        `${i + 1}`,
        c.description.substring(0, 40),
        c.value.toLocaleString("ar-SA"),
        c.source.substring(0, 25),
        new Date(c.date).toLocaleDateString("ar-SA"),
      ],
      y,
      false,
      colWidths
    );
  });

  y += 8;

  // === Final Value ===
  if (y > PAGE_HEIGHT - 60) {
    doc.addPage();
    y = MARGIN;
  }

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 30, 3, 3, "F");
  doc.setDrawColor(...PRIMARY_COLOR);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 30, 3, 3, "S");

  doc.setTextColor(...GRAY);
  doc.setFontSize(10);
  doc.text("القيمة التقديرية النهائية", PAGE_WIDTH / 2, y + 10, { align: "center" });

  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFontSize(20);
  doc.text(
    `${report.estimatedValue.toLocaleString("ar-SA")} ر.س`,
    PAGE_WIDTH / 2,
    y + 22,
    { align: "center" }
  );

  y += 38;

  // Notes
  if (report.notes) {
    y = drawSectionTitle(doc, "ملاحظات", y);
    y = drawKeyValue(doc, "", report.notes, y);
    y += 3;
  }

  // === Signature Page ===
  doc.addPage();
  y = MARGIN;

  y = drawSectionTitle(doc, "التوقيع والاعتماد", y);
  y += 5;

  y = drawKeyValue(doc, "اسم المقيّم", report.evaluatorName, y);
  y = drawKeyValue(doc, "الهيئة السعودية للمقيمين", report.evaluatorCredentials.saudiAuthority, y);
  y = drawKeyValue(doc, "RICS", report.evaluatorCredentials.rics, y);
  y = drawKeyValue(doc, "ASA", report.evaluatorCredentials.asa, y);
  y += 5;

  // Signature image
  if (report.signatureImageUrl) {
    try {
      const img = await loadImage(report.signatureImageUrl);
      doc.addImage(img, "PNG", PAGE_WIDTH / 2 - 25, y, 50, 20);
      y += 25;
    } catch {
      doc.setDrawColor(...GRAY);
      doc.line(PAGE_WIDTH / 2 - 25, y + 15, PAGE_WIDTH / 2 + 25, y + 15);
      y += 20;
    }
  } else {
    doc.setDrawColor(...GRAY);
    doc.line(PAGE_WIDTH / 2 - 25, y + 15, PAGE_WIDTH / 2 + 25, y + 15);
    y += 20;
  }

  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.text("التوقيع", PAGE_WIDTH / 2, y, { align: "center" });
  y += 8;

  const dateLabel = report.issuedAt
    ? new Date(report.issuedAt).toLocaleDateString("ar-SA")
    : new Date(report.createdAt).toLocaleDateString("ar-SA");
  doc.text(`التاريخ: ${dateLabel}`, PAGE_WIDTH / 2, y, { align: "center" });
  y += 15;

  // QR Code
  if (report.verificationToken) {
    const qrUrl = `${window.location.origin}/verify/${report.verificationToken}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 1 });
      doc.addImage(qrDataUrl, "PNG", PAGE_WIDTH / 2 - 15, y, 30, 30);
      y += 33;
      doc.setFontSize(7);
      doc.text("رمز التحقق من التقرير", PAGE_WIDTH / 2, y, { align: "center" });
      y += 4;
      doc.text(qrUrl, PAGE_WIDTH / 2, y, { align: "center" });
    } catch {
      doc.setFontSize(7);
      doc.text(`رابط التحقق: ${qrUrl}`, PAGE_WIDTH / 2, y, { align: "center" });
    }
  }

  // Page numbers
  addPageNumber(doc);

  return doc.output("blob");
}

async function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
