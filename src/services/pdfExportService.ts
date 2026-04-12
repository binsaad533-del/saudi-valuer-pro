import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Report } from "@/types/report";
import { getStatusLabel } from "@/utils/reportWorkflow";
import { formatDate, formatNumber } from "@/lib/utils";
import logoUrl from "@/assets/logo.png";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PRIMARY_COLOR: [number, number, number] = [15, 82, 135];
const DARK: [number, number, number] = [30, 30, 30];
const GRAY: [number, number, number] = [120, 120, 120];
const LIGHT_BG: [number, number, number] = [245, 247, 250];
const GOLD: [number, number, number] = [180, 140, 50];

// Owner password applied to every final (non-draft) PDF.
// Prevents editing, printing, and copying in compliant PDF viewers.
const OWNER_PASSWORD = "jassas-valuation-restricted-2025";

// ─── Deposit Number ───────────────────────────────────────────────────────────

/**
 * Generates a deposit number in the format DEP-YYYY-XXXX.
 * Derived from the numeric tail of the report number so it is deterministic.
 */
export function generateDepositNumber(reportNumber: string): string {
  const year = new Date().getFullYear();
  const digits = reportNumber.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `DEP-${year}-${digits}`;
}

// ─── Logo Cache ───────────────────────────────────────────────────────────────

let _logoDataUrl: string | null = null;

async function getLogoDataUrl(): Promise<string | null> {
  if (_logoDataUrl) return _logoDataUrl;
  try {
    _logoDataUrl = await loadImage(logoUrl);
    return _logoDataUrl;
  } catch {
    return null;
  }
}

// ─── Drawing Helpers ──────────────────────────────────────────────────────────

/** Stamp "مسودة / DRAFT" diagonally on every page (drafts only). */
function drawDraftWatermark(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setGState(new doc.GState({ opacity: 0.12 }));
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(55);
    doc.text("مسودة / DRAFT", PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: "center", angle: 45 });
    doc.setGState(new doc.GState({ opacity: 1 }));
  }
}

/** Faint watermark with client name + report number on every page of final reports. */
function drawFinalWatermark(doc: jsPDF, clientName: string, reportNumber: string) {
  const label = `${clientName} | ${reportNumber}`;
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setGState(new doc.GState({ opacity: 0.05 }));
    doc.setTextColor(...PRIMARY_COLOR);
    doc.setFontSize(22);
    doc.text(label, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: "center", angle: 35 });
    doc.setGState(new doc.GState({ opacity: 1 }));
  }
}

/** Page numbers + deposit number in footer, starting from startPage. */
function addPageNumbers(doc: jsPDF, depositNumber: string, startPage = 2) {
  const total = doc.getNumberOfPages();
  for (let i = startPage; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`${i - startPage + 1} / ${total - startPage + 1}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: "center" });
    doc.text(depositNumber, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: "right" });
  }
}

/** Header on every inner page: logo (right) + report number + confidential label. */
function addHeader(
  doc: jsPDF,
  reportNumber: string,
  logoDataUrl: string | null,
  startPage = 2,
) {
  const total = doc.getNumberOfPages();
  for (let i = startPage; i <= total; i++) {
    doc.setPage(i);
    // Logo — 12×12 mm in upper-right corner
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, "PNG", PAGE_WIDTH - MARGIN - 12, 3, 12, 12);
      } catch {
        // skip if image fails to embed
      }
    }
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(reportNumber, PAGE_WIDTH - MARGIN - 14, 10, { align: "right" });
    doc.text("سري وخاص — Confidential", MARGIN, 10);
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN, 12, PAGE_WIDTH - MARGIN, 12);
  }
}

function checkPageBreak(doc: jsPDF, y: number, needed = 30): number {
  if (y > PAGE_HEIGHT - needed) {
    doc.addPage();
    return MARGIN + 15; // leave room for header
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = checkPageBreak(doc, y, 20);
  doc.setFillColor(...PRIMARY_COLOR);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 8, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(title, PAGE_WIDTH - MARGIN - 4, y + 5.5, { align: "right" });
  doc.setTextColor(...DARK);
  return y + 12;
}

function drawKeyValue(doc: jsPDF, key: string, value: string, y: number): number {
  y = checkPageBreak(doc, y);
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
  y = checkPageBreak(doc, y, 15);
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

// ─── Cover Page ───────────────────────────────────────────────────────────────

function drawCover(doc: jsPDF, report: Report, depositNumber: string, logoDataUrl: string | null) {
  // Full bleed top bar
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, PAGE_WIDTH, 100, "F");

  // Gold accent line
  doc.setFillColor(...GOLD);
  doc.rect(0, 100, PAGE_WIDTH, 3, "F");

  // Logo on cover — top-left, larger
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", MARGIN, 8, 20, 20);
    } catch { /* skip */ }
  }

  // White text on blue
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.text("تقرير تقييم", PAGE_WIDTH / 2, 40, { align: "center" });
  doc.setFontSize(16);
  doc.text("Valuation Report", PAGE_WIDTH / 2, 52, { align: "center" });

  // Divider line
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(PAGE_WIDTH / 2 - 30, 58, PAGE_WIDTH / 2 + 30, 58);

  doc.setFontSize(12);
  doc.text(report.reportNumber, PAGE_WIDTH / 2, 68, { align: "center" });
  doc.setFontSize(10);
  doc.text(formatDate(report.createdAt), PAGE_WIDTH / 2, 78, { align: "center" });

  const statusLabel = getStatusLabel(report.status);
  doc.setFontSize(9);
  doc.text(`الحالة: ${statusLabel}`, PAGE_WIDTH / 2, 92, { align: "center" });

  // Client info block
  let y = 120;
  doc.setTextColor(...DARK);

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(MARGIN, y - 5, CONTENT_WIDTH, 55, 3, 3, "F");
  doc.setDrawColor(...PRIMARY_COLOR);
  doc.roundedRect(MARGIN, y - 5, CONTENT_WIDTH, 55, 3, 3, "S");

  y += 5;
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text("بيانات التكليف", PAGE_WIDTH - MARGIN - 8, y, { align: "right" });
  y += 10;

  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  const assetLabel =
    report.assetType === "real_estate" ? "عقار" :
    report.assetType === "equipment" ? "معدات" : "مركبة";

  const coverFields: [string, string][] = [
    ["العميل", report.clientName],
    ["نوع الأصل", assetLabel],
    ["الموقع", report.assetLocation],
  ];

  coverFields.forEach(([label, val]) => {
    doc.setTextColor(...GRAY);
    doc.setFontSize(9);
    doc.text(`${label}:`, PAGE_WIDTH - MARGIN - 8, y, { align: "right" });
    doc.setTextColor(...DARK);
    doc.setFontSize(10);
    doc.text(val, PAGE_WIDTH - MARGIN - 40, y, { align: "right" });
    y += 8;
  });

  // Deposit number on cover
  y += 6;
  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.text(`رقم الإيداع: ${depositNumber}`, PAGE_WIDTH - MARGIN - 8, y, { align: "right" });

  // Company info footer band
  y = PAGE_HEIGHT - 50;
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, y, PAGE_WIDTH, 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text("شركة جساس للتقييم", PAGE_WIDTH / 2, y + 15, { align: "center" });
  doc.setFontSize(9);
  doc.text("Jassas Valuation Company", PAGE_WIDTH / 2, y + 23, { align: "center" });
  doc.setFontSize(8);
  doc.text(
    "سجل تجاري: 1010625839 | الرقم الضريبي: 310625839900003 | ترخيص تقييم معتمد",
    PAGE_WIDTH / 2, y + 33, { align: "center" },
  );
  doc.setFillColor(...GOLD);
  doc.rect(0, y, PAGE_WIDTH, 2, "F");
}

// ─── Table of Contents ────────────────────────────────────────────────────────

function drawTableOfContents(doc: jsPDF, report: Report) {
  doc.addPage();
  let y = MARGIN + 15;

  doc.setFillColor(...PRIMARY_COLOR);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 10, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text("جدول المحتويات", PAGE_WIDTH / 2, y + 7, { align: "center" });
  y += 18;

  const tocItems = [
    "1. بيانات التكليف والعميل",
    "2. وصف الأصل",
    "3. منهجية التقييم",
    "4. تحليل السوق",
    "5. المقارنات السوقية",
    "6. القيمة التقديرية النهائية",
  ];

  if (report.notes) tocItems.push("7. ملاحظات");
  tocItems.push(`${tocItems.length + 1}. التوقيع والاعتماد`);

  tocItems.forEach((item, i) => {
    doc.setTextColor(...DARK);
    doc.setFontSize(11);
    doc.text(item, PAGE_WIDTH - MARGIN - 8, y, { align: "right" });

    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([1, 2], 0);
    doc.line(MARGIN + 10, y, PAGE_WIDTH - MARGIN - 80, y);
    doc.setLineDashPattern([], 0);

    doc.setTextColor(...GRAY);
    doc.setFontSize(9);
    doc.text(`${i + 2}`, MARGIN + 4, y, { align: "left" });
    y += 10;
  });
}

// ─── Main Export Function ─────────────────────────────────────────────────────

export async function exportReportToPDF(report: Report): Promise<Blob> {
  const isDraft = report.status === "draft" || report.status === "review";
  const depositNumber = generateDepositNumber(report.reportNumber);
  const logoDataUrl = await getLogoDataUrl();

  // Final reports get AES-128 encryption: open freely (userPassword=""),
  // but owner password blocks editing / copying / printing.
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    ...(isDraft
      ? {}
      : {
          encryption: {
            userPassword: "",
            ownerPassword: OWNER_PASSWORD,
            userPermissions: [] as any[], // no print, copy, or modify
          },
        }),
  });

  // 1. Cover
  drawCover(doc, report, depositNumber, logoDataUrl);

  // 2. Table of Contents
  drawTableOfContents(doc, report);

  // 3. Content pages
  doc.addPage();
  let y = MARGIN + 15;

  y = drawSectionTitle(doc, "1. بيانات التكليف والعميل", y);
  y = drawKeyValue(doc, "العميل", report.clientName, y);
  y = drawKeyValue(doc, "البريد الإلكتروني", report.clientEmail, y);
  y = drawKeyValue(doc, "الهاتف", report.clientPhone, y);
  y += 5;

  y = drawSectionTitle(doc, "2. وصف الأصل", y);
  y = drawKeyValue(doc, "الوصف", report.assetDescription, y);
  y = drawKeyValue(doc, "الموقع", report.assetLocation, y);
  y += 5;

  y = drawSectionTitle(doc, "3. منهجية التقييم", y);
  const methodMap: Record<string, string> = {
    market_comparison: "أسلوب المقارنة بالسوق",
    income: "أسلوب الدخل",
    cost: "أسلوب التكلفة",
    combined: "أسلوب مشترك",
  };
  y = drawKeyValue(doc, "الأسلوب المستخدم", methodMap[report.methodology] || report.methodology, y);
  y += 5;

  y = drawSectionTitle(doc, "4. تحليل السوق", y);
  y = drawKeyValue(doc, "التحليل", report.marketAnalysis, y);
  y += 5;

  // Comparables Table
  y = drawSectionTitle(doc, "5. المقارنات السوقية", y);
  const colWidths = [15, 55, 35, 40, 25];
  y = drawTableRow(doc, ["#", "الوصف", "القيمة (ر.س)", "المصدر", "التاريخ"], y, true, colWidths);

  report.comparables.forEach((c, i) => {
    y = drawTableRow(
      doc,
      [
        `${i + 1}`,
        c.description.substring(0, 40),
        formatNumber(c.value),
        c.source.substring(0, 25),
        formatDate(c.date),
      ],
      y,
      false,
      colWidths,
    );
  });
  y += 8;

  // Final Value
  y = checkPageBreak(doc, y, 50);
  y = drawSectionTitle(doc, "6. القيمة التقديرية النهائية", y);

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 3, 3, "F");
  doc.setDrawColor(...PRIMARY_COLOR);
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 3, 3, "S");
  doc.setLineWidth(0.2);

  doc.setFillColor(...GOLD);
  doc.rect(MARGIN, y, 3, 35, "F");

  doc.setTextColor(...GRAY);
  doc.setFontSize(10);
  doc.text("القيمة التقديرية النهائية", PAGE_WIDTH / 2, y + 10, { align: "center" });

  doc.setTextColor(...PRIMARY_COLOR);
  doc.setFontSize(22);
  doc.text(`${formatNumber(report.estimatedValue)} ر.س`, PAGE_WIDTH / 2, y + 25, { align: "center" });
  y += 42;

  // Notes
  if (report.notes) {
    y = drawSectionTitle(doc, "7. ملاحظات", y);
    y = drawKeyValue(doc, "", report.notes, y);
    y += 5;
  }

  // 4. Signature Page
  doc.addPage();
  y = MARGIN + 15;

  y = drawSectionTitle(doc, "التوقيع والاعتماد", y);
  y += 5;
  y = drawKeyValue(doc, "اسم المقيّم", report.evaluatorName, y);
  y = drawKeyValue(doc, "الهيئة السعودية للمقيمين", report.evaluatorCredentials.saudiAuthority, y);
  y = drawKeyValue(doc, "RICS", report.evaluatorCredentials.rics, y);
  y = drawKeyValue(doc, "ASA", report.evaluatorCredentials.asa, y);
  y += 8;

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

  const dateLabel = report.issuedAt ? formatDate(report.issuedAt) : formatDate(report.createdAt);
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

  // Deposit number on signature page
  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`رقم الإيداع: ${depositNumber}`, PAGE_WIDTH / 2, y, { align: "center" });

  // ── Post-processing (order matters: headers/footers first, watermarks last) ──
  addHeader(doc, report.reportNumber, logoDataUrl, 2);
  addPageNumbers(doc, depositNumber, 2);

  if (isDraft) {
    drawDraftWatermark(doc);
  } else {
    drawFinalWatermark(doc, report.clientName, report.reportNumber);
  }

  return doc.output("blob");
}

// ─── Utilities ────────────────────────────────────────────────────────────────

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
