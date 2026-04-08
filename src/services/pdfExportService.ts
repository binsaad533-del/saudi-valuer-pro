import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Report } from "@/types/report";
import { getStatusLabel } from "@/utils/reportWorkflow";
import { formatDate, formatNumber } from "@/lib/utils";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PRIMARY_COLOR: [number, number, number] = [15, 82, 135];
const DARK: [number, number, number] = [30, 30, 30];
const GRAY: [number, number, number] = [120, 120, 120];
const LIGHT_BG: [number, number, number] = [245, 247, 250];
const GOLD: [number, number, number] = [180, 140, 50];

// ─── Drawing Helpers ───

function drawDraftWatermark(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(55);
    doc.text("مسودة / DRAFT", PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: "center", angle: 45 });
  }
}

function drawTestWatermark(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Red watermark for test reports
    doc.setTextColor(255, 80, 80);
    doc.setFontSize(40);
    doc.text("TEST REPORT — NOT FOR OFFICIAL USE", PAGE_WIDTH / 2, PAGE_HEIGHT / 2 - 15, { align: "center", angle: 45 });
    doc.setFontSize(30);
    doc.text("تقرير تجريبي غير معتمد للاستخدام الرسمي", PAGE_WIDTH / 2, PAGE_HEIGHT / 2 + 15, { align: "center", angle: 45 });
  }
}

function addPageNumbers(doc: jsPDF, startPage = 2) {
  const total = doc.getNumberOfPages();
  for (let i = startPage; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`${i - startPage + 1} / ${total - startPage + 1}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: "center" });
    // Footer line
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12);
  }
}

function addHeader(doc: jsPDF, reportNumber: string, startPage = 2) {
  const total = doc.getNumberOfPages();
  for (let i = startPage; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(reportNumber, PAGE_WIDTH - MARGIN, 10, { align: "right" });
    doc.text("سري وخاص — Confidential", MARGIN, 10);
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN, 12, PAGE_WIDTH - MARGIN, 12);
  }
}

function checkPageBreak(doc: jsPDF, y: number, needed = 30): number {
  if (y > PAGE_HEIGHT - needed) {
    doc.addPage();
    return MARGIN + 5;
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

// ─── Cover Page ───

function drawCover(doc: jsPDF, report: Report) {
  // Full bleed top bar
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, PAGE_WIDTH, 100, "F");

  // Gold accent line
  doc.setFillColor(...GOLD);
  doc.rect(0, 100, PAGE_WIDTH, 3, "F");

  // White text on blue
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.text("تقرير تقييم", PAGE_WIDTH / 2, 35, { align: "center" });
  doc.setFontSize(16);
  doc.text("Valuation Report", PAGE_WIDTH / 2, 48, { align: "center" });

  // Divider line
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(PAGE_WIDTH / 2 - 30, 55, PAGE_WIDTH / 2 + 30, 55);

  doc.setFontSize(12);
  doc.text(report.reportNumber, PAGE_WIDTH / 2, 65, { align: "center" });
  doc.setFontSize(10);
  doc.text(formatDate(report.createdAt), PAGE_WIDTH / 2, 75, { align: "center" });

  const statusLabel = getStatusLabel(report.status);
  doc.setFontSize(9);
  doc.text(`الحالة: ${statusLabel}`, PAGE_WIDTH / 2, 90, { align: "center" });

  // Client info block
  let y = 120;
  doc.setTextColor(...DARK);

  // Decorative box for client info
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
  const assetLabel = report.assetType === "real_estate" ? "عقار" : report.assetType === "equipment" ? "معدات" : "مركبة";

  const coverFields = [
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

  // Company info at bottom
  y = PAGE_HEIGHT - 50;
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, y, PAGE_WIDTH, 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text("شركة جساس للتقييم", PAGE_WIDTH / 2, y + 15, { align: "center" });
  doc.setFontSize(9);
  doc.text("Jassas Valuation Company", PAGE_WIDTH / 2, y + 23, { align: "center" });
  doc.setFontSize(8);
  doc.text("سجل تجاري: 1010625839 | الرقم الضريبي: 310625839900003 | ترخيص تقييم معتمد", PAGE_WIDTH / 2, y + 33, { align: "center" });
  doc.setFillColor(...GOLD);
  doc.rect(0, y, PAGE_WIDTH, 2, "F");
}

// ─── Table of Contents ───

function drawTableOfContents(doc: jsPDF, report: Report) {
  doc.addPage();
  let y = MARGIN + 5;

  doc.setFillColor(...PRIMARY_COLOR);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 10, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text("جدول المحتويات", PAGE_WIDTH / 2, y + 7, { align: "center" });
  y += 18;

  const tocItems = [
    "1. بيانات التكليف والعميل",
    "2. نطاق العمل والافتراضات",
    "3. وصف الأصل",
    "4. منهجية التقييم",
    "5. تحليل السوق",
    "6. المقارنات السوقية",
    "7. التسوية والقيمة النهائية",
  ];

  if (report.notes) tocItems.push(`${tocItems.length + 1}. ملاحظات`);
  tocItems.push(`${tocItems.length + 1}. التوقيع والاعتماد`);
  tocItems.push(`${tocItems.length + 1}. إخلاء المسؤولية والقيود`);

  tocItems.forEach((item, i) => {
    doc.setTextColor(...DARK);
    doc.setFontSize(11);
    doc.text(item, PAGE_WIDTH - MARGIN - 8, y, { align: "right" });

    // Dotted line
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

// ─── Main Export Function ───

export async function exportReportToPDF(report: Report, options?: { isTestMode?: boolean }): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const isDraft = report.status === "draft" || report.status === "review";
  const isTest = options?.isTestMode ?? false;

  // 1. Cover
  drawCover(doc, report);

  // 2. Table of Contents
  drawTableOfContents(doc, report);

  // 3. Content pages
  doc.addPage();
  let y = MARGIN + 5;

  y = drawSectionTitle(doc, "1. بيانات التكليف والعميل", y);
  y = drawKeyValue(doc, "العميل", report.clientName, y);
  y = drawKeyValue(doc, "البريد الإلكتروني", report.clientEmail, y);
  y = drawKeyValue(doc, "الهاتف", report.clientPhone, y);
  y += 5;

  // ── Section 2: Scope of Work & Assumptions (IVS 101/105) ──
  y = drawSectionTitle(doc, "2. نطاق العمل والافتراضات", y);
  y = drawKeyValue(doc, "أساس القيمة", "القيمة السوقية وفقاً لمعيار IVS 104", y);
  y = drawKeyValue(doc, "الغرض من التقييم", report.notes ? "بيع / شراء" : "أغراض عامة", y);

  // Valuation path assumption
  const assetLabel = report.assetType === "real_estate" ? "عقار" : report.assetType === "equipment" ? "معدات" : "مركبة";
  y = drawKeyValue(doc, "الافتراضات العامة",
    "يُفترض أن جميع المعلومات المقدمة من العميل صحيحة ودقيقة. " +
    "يُفترض عدم وجود عيوب خفية لا تظهر بالمعاينة البصرية. " +
    "يُفترض أن الأصل لا يخضع لأي نزاعات قانونية ما لم يُذكر خلاف ذلك.", y);
  y = drawKeyValue(doc, "القيود",
    "هذا التقرير مُعد للغرض المذكور أعلاه فقط ولا يجوز استخدامه لأي غرض آخر. " +
    "القيمة المقدرة صالحة في تاريخ التقييم فقط وقد تتغير مع تغير ظروف السوق.", y);
  y += 5;

  y = drawSectionTitle(doc, "3. وصف الأصل", y);
  y = drawKeyValue(doc, "نوع الأصل", assetLabel, y);
  y = drawKeyValue(doc, "الوصف", report.assetDescription, y);
  y = drawKeyValue(doc, "الموقع", report.assetLocation, y);
  y += 5;

  y = drawSectionTitle(doc, "4. منهجية التقييم", y);
  const methodMap: Record<string, string> = {
    market_comparison: "أسلوب المقارنة بالسوق (IVS 105.20)",
    income: "أسلوب الدخل (IVS 105.40)",
    cost: "أسلوب التكلفة (IVS 105.60)",
    combined: "أسلوب مشترك",
  };
  y = drawKeyValue(doc, "الأسلوب المستخدم", methodMap[report.methodology] || report.methodology, y);
  y = drawKeyValue(doc, "مبررات اختيار المنهجية",
    "تم اختيار هذه المنهجية بناءً على طبيعة الأصل، وتوفر بيانات السوق المقارنة، وامتثالاً لمعايير التقييم الدولية IVS 2025.", y);
  y += 5;

  y = drawSectionTitle(doc, "5. تحليل السوق", y);
  y = drawKeyValue(doc, "التحليل", report.marketAnalysis, y);
  y += 5;

  // Comparables Table
  y = drawSectionTitle(doc, "6. المقارنات السوقية", y);
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
      colWidths
    );
  });
  y += 8;

  // ── Section 7: Reconciliation & Final Value (IVS 105.10) ──
  y = checkPageBreak(doc, y, 70);
  y = drawSectionTitle(doc, "7. التسوية والقيمة النهائية", y);
  y = drawKeyValue(doc, "التسوية (Reconciliation)",
    "بعد تطبيق المنهجية المعتمدة وإجراء التسويات اللازمة على المقارنات السوقية، " +
    "ومراعاة عوامل الموقع والحالة والمساحة، وبعد تطبيق الحكم المهني للمقيّم المعتمد " +
    "وفقاً لمتطلبات معيار IVS 105 (فقرات 209، 219، 351)، تم التوصل إلى القيمة النهائية التالية:", y);
  y += 3;

  // Final Value - prominent box
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 3, 3, "F");
  doc.setDrawColor(...PRIMARY_COLOR);
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 35, 3, 3, "S");
  doc.setLineWidth(0.2);

  // Gold accent
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
    y = drawSectionTitle(doc, "8. ملاحظات", y);
    y = drawKeyValue(doc, "", report.notes, y);
    y += 5;
  }

  // Signature Page
  doc.addPage();
  y = MARGIN + 5;

  y = drawSectionTitle(doc, "التوقيع والاعتماد", y);
  y += 5;
  y = drawKeyValue(doc, "اسم المقيّم", report.evaluatorName, y);
  y = drawKeyValue(doc, "الهيئة السعودية للمقيمين", report.evaluatorCredentials.saudiAuthority, y);
  y = drawKeyValue(doc, "RICS", report.evaluatorCredentials.rics, y);
  y = drawKeyValue(doc, "ASA", report.evaluatorCredentials.asa, y);
  y += 8;

  // Auto-embed electronic signature
  let signatureLoaded = false;
  if (report.signatureImageUrl) {
    try {
      const img = await loadImage(report.signatureImageUrl);
      doc.addImage(img, "PNG", PAGE_WIDTH / 2 - 25, y, 50, 20);
      y += 25;
      signatureLoaded = true;
    } catch {
      // Fallback to line if image fails
    }
  }

  // If no signature image or final report, try to load from storage
  if (!signatureLoaded && !isDraft) {
    try {
      const { data: sigFiles } = await (await import("@/integrations/supabase/client")).supabase
        .storage.from("signatures").list("", { limit: 1, sortBy: { column: "created_at", order: "desc" } });
      if (sigFiles && sigFiles.length > 0) {
        const { data: sigUrl } = (await import("@/integrations/supabase/client")).supabase
          .storage.from("signatures").getPublicUrl(sigFiles[0].name);
        if (sigUrl?.publicUrl) {
          try {
            const sigImg = await loadImage(sigUrl.publicUrl);
            doc.addImage(sigImg, "PNG", PAGE_WIDTH / 2 - 25, y, 50, 20);
            y += 25;
            signatureLoaded = true;
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }

  if (!signatureLoaded) {
    doc.setDrawColor(...GRAY);
    doc.line(PAGE_WIDTH / 2 - 25, y + 15, PAGE_WIDTH / 2 + 25, y + 15);
    y += 20;
  }

  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.text(signatureLoaded ? "التوقيع الإلكتروني المعتمد" : "التوقيع", PAGE_WIDTH / 2, y, { align: "center" });
  y += 8;

  const dateLabel = report.issuedAt ? formatDate(report.issuedAt) : formatDate(report.createdAt);
  doc.text(`التاريخ: ${dateLabel}`, PAGE_WIDTH / 2, y, { align: "center" });
  y += 5;

  // Certification stamp for final (non-draft) reports
  if (!isDraft && !isTest) {
    y += 5;
    doc.setFillColor(240, 248, 240);
    doc.roundedRect(MARGIN + 20, y, CONTENT_WIDTH - 40, 22, 2, 2, "F");
    doc.setDrawColor(34, 139, 34);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN + 20, y, CONTENT_WIDTH - 40, 22, 2, 2, "S");
    doc.setLineWidth(0.2);
    doc.setTextColor(34, 139, 34);
    doc.setFontSize(9);
    doc.text("✓ تقرير معتمد إلكترونياً — Electronically Certified Report", PAGE_WIDTH / 2, y + 9, { align: "center" });
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`رقم التقرير: ${report.reportNumber} | تاريخ الإصدار: ${dateLabel}`, PAGE_WIDTH / 2, y + 17, { align: "center" });
    y += 28;
  }

  y += 5;

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

  // Post-processing
  addHeader(doc, report.reportNumber, 2);
  addPageNumbers(doc, 2);

  if (isTest) {
    drawTestWatermark(doc);
  } else if (isDraft) {
    drawDraftWatermark(doc);
  }

  return doc.output("blob");
}

// ─── Utilities ───

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
