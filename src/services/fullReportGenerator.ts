/**
 * Full Valuation Report Generator
 * مولد التقرير المهني الكامل
 *
 * Extends the existing pdfExportService with additional sections:
 * justification, risk analysis, compliance statement, assumptions.
 */

import jsPDF from "jspdf";
import QRCode from "qrcode";
import { formatNumber } from "@/lib/utils";
import type { ConfidenceResult } from "@/lib/confidence-scoring";
import type { RiskReport } from "@/lib/risk-detection";
import type { DecisionResult } from "@/lib/decision-engine";

// ── Constants ──────────────────────────────────────────

const PW = 210;
const PH = 297;
const M = 20;
const CW = PW - M * 2;
const PRIMARY: [number, number, number] = [15, 82, 135];
const DARK: [number, number, number] = [30, 30, 30];
const GRAY: [number, number, number] = [120, 120, 120];
const LIGHT: [number, number, number] = [245, 247, 250];
const GOLD: [number, number, number] = [180, 140, 50];
const GREEN: [number, number, number] = [34, 139, 34];
const RED: [number, number, number] = [180, 40, 40];

// ── Types ──────────────────────────────────────────────

export interface FullReportData {
  reportNumber: string;
  reportDate: string;
  valuationDate: string;
  isDraft: boolean;

  client: {
    name: string;
    type: string;
    phone: string;
    email: string;
    idNumber: string;
  };

  property: {
    type: string;
    category: string;
    address: string;
    city: string;
    district: string;
    landArea: number;
    buildingArea: number;
    floors: number;
    yearBuilt: number;
    lat: number;
    lng: number;
  };

  valuation: {
    purpose: string;
    basisOfValue: string;
    approach: string;
    estimatedValue: number;
    currency: string;
    pricePerSqm: number;
    methodValues?: { method: string; value: number }[];
  };

  assumptions?: string[];
  justifications?: Record<string, string>;

  confidence?: ConfidenceResult;
  risks?: RiskReport;
  decision?: DecisionResult;

  inspector?: {
    name: string;
    date: string;
    condition: string;
    conditionScore: number;
    notes: string;
    risks: string[];
  };

  valuer: string;
  reviewer: string;
  evaluatorCredentials?: { saudiAuthority: string; rics: string; asa: string };
  signatureUrl?: string | null;
  verificationToken?: string;
}

// ── Drawing helpers ────────────────────────────────────

function pageBreak(doc: jsPDF, y: number, needed = 30): number {
  if (y > PH - needed) {
    doc.addPage();
    return M + 5;
  }
  return y;
}

function sectionTitle(doc: jsPDF, title: string, y: number, num?: string): number {
  y = pageBreak(doc, y, 20);
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(M, y, CW, 8, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(num ? `${num}. ${title}` : title, PW - M - 4, y + 5.5, { align: "right" });
  doc.setTextColor(...DARK);
  return y + 12;
}

function kv(doc: jsPDF, key: string, value: string, y: number): number {
  y = pageBreak(doc, y);
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(key, PW - M - 4, y, { align: "right" });
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(value || "—", CW - 10);
  doc.text(lines, PW - M - 4, y + 5, { align: "right" });
  return y + 5 + lines.length * 5 + 3;
}

function paragraph(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  const lines = doc.splitTextToSize(text, CW - 8);
  for (const line of lines) {
    y = pageBreak(doc, y);
    doc.text(line, PW - M - 4, y, { align: "right" });
    y += 5;
  }
  return y + 3;
}

function addHeaders(doc: jsPDF, reportNumber: string, startPage = 2) {
  const total = doc.getNumberOfPages();
  for (let i = startPage; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(reportNumber, PW - M, 10, { align: "right" });
    doc.text("سري وخاص — Confidential", M, 10);
    doc.setDrawColor(200, 200, 200);
    doc.line(M, 12, PW - M, 12);
    // Page number
    doc.text(`${i - startPage + 1} / ${total - startPage + 1}`, PW / 2, PH - 8, { align: "center" });
    doc.line(M, PH - 12, PW - M, PH - 12);
  }
}

function watermark(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(55);
    doc.text("مسودة / DRAFT", PW / 2, PH / 2, { align: "center", angle: 45 });
  }
}

// ── Cover ──────────────────────────────────────────────

function drawCover(doc: jsPDF, d: FullReportData) {
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, PW, 100, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 100, PW, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.text("تقرير تقييم", PW / 2, 35, { align: "center" });
  doc.setFontSize(16);
  doc.text("Valuation Report", PW / 2, 48, { align: "center" });
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(PW / 2 - 30, 55, PW / 2 + 30, 55);
  doc.setFontSize(12);
  doc.text(d.reportNumber, PW / 2, 65, { align: "center" });
  doc.setFontSize(10);
  doc.text(d.reportDate, PW / 2, 75, { align: "center" });
  doc.setFontSize(9);
  doc.text(`الحالة: ${d.isDraft ? "مسودة" : "نهائي"}`, PW / 2, 90, { align: "center" });

  // Client box
  let y = 120;
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y - 5, CW, 55, 3, 3, "F");
  doc.setDrawColor(...PRIMARY);
  doc.roundedRect(M, y - 5, CW, 55, 3, 3, "S");
  y += 5;
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.text("بيانات التكليف", PW - M - 8, y, { align: "right" });
  y += 10;
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  const fields = [
    ["العميل", d.client.name],
    ["نوع العقار", d.property.type],
    ["الموقع", `${d.property.city} - ${d.property.district}`],
  ];
  for (const [label, val] of fields) {
    doc.setTextColor(...GRAY);
    doc.setFontSize(9);
    doc.text(`${label}:`, PW - M - 8, y, { align: "right" });
    doc.setTextColor(...DARK);
    doc.setFontSize(10);
    doc.text(val, PW - M - 40, y, { align: "right" });
    y += 8;
  }

  // Footer
  y = PH - 50;
  doc.setFillColor(...PRIMARY);
  doc.rect(0, y, PW, 50, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, y, PW, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text("شركة جساس للتقييم", PW / 2, y + 15, { align: "center" });
  doc.setFontSize(9);
  doc.text("Jassas Valuation Company", PW / 2, y + 23, { align: "center" });
  doc.setFontSize(8);
  doc.text("سجل تجاري: 1010625839 | الرقم الضريبي: 310625839900003 | ترخيص تقييم معتمد", PW / 2, y + 33, { align: "center" });
}

// ── TOC ────────────────────────────────────────────────

function drawTOC(doc: jsPDF) {
  doc.addPage();
  let y = M + 5;
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(M, y, CW, 10, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text("جدول المحتويات", PW / 2, y + 7, { align: "center" });
  y += 18;

  const items = [
    "الملخص التنفيذي",
    "تعريف المهمة",
    "وصف الأصل",
    "منهجية التقييم",
    "التحليل والحسابات",
    "المبررات المهنية",
    "تحليل المخاطر",
    "بيان الامتثال",
    "القيمة النهائية",
    "التوقيع والاعتماد",
  ];

  items.forEach((item, i) => {
    doc.setTextColor(...DARK);
    doc.setFontSize(11);
    doc.text(`${i + 1}. ${item}`, PW - M - 8, y, { align: "right" });
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([1, 2], 0);
    doc.line(M + 10, y, PW - M - 80, y);
    doc.setLineDashPattern([], 0);
    y += 10;
  });
}

// ── Main Generator ─────────────────────────────────────

export async function generateFullReport(d: FullReportData): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // 1. Cover
  drawCover(doc, d);

  // 2. TOC
  drawTOC(doc);

  // ─── Section 1: Executive Summary ───
  doc.addPage();
  let y = M + 5;
  y = sectionTitle(doc, "الملخص التنفيذي", y, "1");
  y = kv(doc, "الغرض من التقييم", d.valuation.purpose, y);
  y = kv(doc, "القيمة التقديرية", `${formatNumber(d.valuation.estimatedValue)} ${d.valuation.currency}`, y);
  if (d.confidence) {
    const levelAr = d.confidence.level === "high" ? "عالية" : d.confidence.level === "good" ? "جيدة" : d.confidence.level === "moderate" ? "متوسطة" : "منخفضة";
    y = kv(doc, "مؤشر الثقة", `${d.confidence.overall}% — ${levelAr}`, y);
  }
  if (d.decision) {
    y = kv(doc, "توصية القرار", d.decision.title_ar, y);
  }
  y += 5;

  // ─── Section 2: Assignment Definition ───
  y = sectionTitle(doc, "تعريف المهمة", y, "2");
  y = kv(doc, "الغرض", d.valuation.purpose, y);
  y = kv(doc, "أساس القيمة", d.valuation.basisOfValue, y);
  y = kv(doc, "تاريخ التقييم", d.valuationDate, y);
  if (d.assumptions && d.assumptions.length > 0) {
    y = kv(doc, "الافتراضات", "", y);
    for (const a of d.assumptions) {
      y = pageBreak(doc, y);
      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      doc.text(`• ${a}`, PW - M - 8, y, { align: "right" });
      y += 6;
    }
  }
  y += 5;

  // ─── Section 3: Asset Description ───
  y = sectionTitle(doc, "وصف الأصل", y, "3");
  y = kv(doc, "نوع العقار", d.property.type, y);
  y = kv(doc, "التصنيف", d.property.category, y);
  y = kv(doc, "المدينة", d.property.city, y);
  y = kv(doc, "الحي", d.property.district, y);
  y = kv(doc, "العنوان", d.property.address, y);
  y = kv(doc, "مساحة الأرض", `${formatNumber(d.property.landArea)} م²`, y);
  y = kv(doc, "مساحة البناء", `${formatNumber(d.property.buildingArea)} م²`, y);
  y = kv(doc, "عدد الأدوار", String(d.property.floors), y);
  y = kv(doc, "سنة البناء", String(d.property.yearBuilt), y);
  y += 5;

  // ─── Section 4: Methodology ───
  y = sectionTitle(doc, "منهجية التقييم", y, "4");
  y = kv(doc, "المنهجية المستخدمة", d.valuation.approach, y);
  if (d.justifications?.method_selection) {
    y = paragraph(doc, d.justifications.method_selection, y);
  }
  y += 5;

  // ─── Section 5: Analysis & Calculations ───
  y = sectionTitle(doc, "التحليل والحسابات", y, "5");
  y = kv(doc, "سعر المتر المربع", `${formatNumber(d.valuation.pricePerSqm)} ${d.valuation.currency}/م²`, y);
  if (d.valuation.methodValues && d.valuation.methodValues.length > 0) {
    y += 3;
    for (const mv of d.valuation.methodValues) {
      y = kv(doc, mv.method, `${formatNumber(mv.value)} ${d.valuation.currency}`, y);
    }
  }
  if (d.justifications?.adjustments) {
    y += 3;
    y = paragraph(doc, d.justifications.adjustments, y);
  }
  if (d.justifications?.reconciliation) {
    y += 3;
    y = paragraph(doc, d.justifications.reconciliation, y);
  }
  y += 5;

  // ─── Section 6: Justification ───
  y = sectionTitle(doc, "المبررات المهنية", y, "6");
  if (d.justifications?.data_assessment) {
    y = kv(doc, "تقييم البيانات", "", y);
    y = paragraph(doc, d.justifications.data_assessment, y);
  }
  if (d.justifications?.assumptions) {
    y = kv(doc, "شرح الافتراضات", "", y);
    y = paragraph(doc, d.justifications.assumptions, y);
  }
  y += 5;

  // ─── Section 7: Risk Analysis ───
  y = sectionTitle(doc, "تحليل المخاطر", y, "7");
  if (d.risks && d.risks.risks.length > 0) {
    const levelAr = d.risks.overallLevel === "high" ? "عالية" : d.risks.overallLevel === "medium" ? "متوسطة" : "منخفضة";
    y = kv(doc, "مستوى المخاطر الإجمالي", levelAr, y);
    for (const risk of d.risks.risks) {
      y = pageBreak(doc, y, 15);
      const sev = risk.severity === "high" ? "عالية" : risk.severity === "medium" ? "متوسطة" : "منخفضة";
      doc.setFontSize(9);
      doc.setTextColor(risk.severity === "high" ? RED[0] : DARK[0], risk.severity === "high" ? RED[1] : DARK[1], risk.severity === "high" ? RED[2] : DARK[2]);
      doc.text(`• ${risk.title_ar} (${sev})`, PW - M - 8, y, { align: "right" });
      y += 5;
      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.text(risk.description_ar, PW - M - 12, y, { align: "right" });
      y += 7;
    }
  } else {
    y = paragraph(doc, "لم يتم اكتشاف مخاطر جوهرية في هذا التقييم.", y);
  }
  if (d.justifications?.risk_commentary) {
    y += 3;
    y = paragraph(doc, d.justifications.risk_commentary, y);
  }
  y += 5;

  // ─── Section 8: Compliance Statement ───
  y = sectionTitle(doc, "بيان الامتثال", y, "8");
  doc.setFontSize(10);
  doc.setTextColor(...GREEN);
  y = pageBreak(doc, y);
  doc.text("✓ يتوافق هذا التقرير مع:", PW - M - 4, y, { align: "right" });
  y += 7;
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  const standards = [
    "معايير التقييم الدولية (IVS 2025)",
    "معايير الهيئة السعودية للمقيمين المعتمدين (تقييم)",
    "معايير RICS Red Book",
  ];
  for (const s of standards) {
    y = pageBreak(doc, y);
    doc.text(`• ${s}`, PW - M - 8, y, { align: "right" });
    y += 6;
  }
  if (d.confidence) {
    y += 3;
    y = kv(doc, "مؤشر الثقة المهنية", `${d.confidence.overall}%`, y);
  }
  y += 5;

  // ─── Section 9: Final Value ───
  y = pageBreak(doc, y, 50);
  y = sectionTitle(doc, "القيمة النهائية", y, "9");
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y, CW, 35, 3, 3, "F");
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.8);
  doc.roundedRect(M, y, CW, 35, 3, 3, "S");
  doc.setLineWidth(0.2);
  doc.setFillColor(...GOLD);
  doc.rect(M, y, 3, 35, "F");
  doc.setTextColor(...GRAY);
  doc.setFontSize(10);
  doc.text("القيمة التقديرية النهائية", PW / 2, y + 10, { align: "center" });
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(22);
  doc.text(`${formatNumber(d.valuation.estimatedValue)} ${d.valuation.currency}`, PW / 2, y + 25, { align: "center" });
  y += 45;

  // ─── Section 10: Signature ───
  doc.addPage();
  y = M + 5;
  y = sectionTitle(doc, "التوقيع والاعتماد", y, "10");
  y += 5;
  y = kv(doc, "اسم المقيّم", d.valuer, y);
  y = kv(doc, "المراجع", d.reviewer, y);
  if (d.evaluatorCredentials) {
    y = kv(doc, "الهيئة السعودية للمقيمين", d.evaluatorCredentials.saudiAuthority, y);
    y = kv(doc, "RICS", d.evaluatorCredentials.rics, y);
    y = kv(doc, "ASA", d.evaluatorCredentials.asa, y);
  }
  y += 10;

  if (d.isDraft) {
    doc.setDrawColor(...GRAY);
    doc.setLineDashPattern([3, 3], 0);
    doc.roundedRect(PW / 2 - 35, y, 70, 25, 2, 2, "S");
    doc.setLineDashPattern([], 0);
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text("في انتظار التوقيع والاعتماد", PW / 2, y + 14, { align: "center" });
    y += 30;
  } else if (d.signatureUrl) {
    try {
      const img = await loadImage(d.signatureUrl);
      doc.addImage(img, "PNG", PW / 2 - 25, y, 50, 20);
      y += 25;
    } catch {
      doc.setDrawColor(...GRAY);
      doc.line(PW / 2 - 25, y + 15, PW / 2 + 25, y + 15);
      y += 20;
    }
  }

  // QR Code
  if (d.verificationToken) {
    y += 10;
    const qrUrl = `${window.location.origin}/verify/${d.verificationToken}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 1, errorCorrectionLevel: "H" });
      doc.addImage(qrDataUrl, "PNG", PW / 2 - 15, y, 30, 30);
      y += 33;
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text("رمز التحقق من التقرير", PW / 2, y, { align: "center" });
    } catch {
      // skip QR
    }
  }

  // Post-process
  addHeaders(doc, d.reportNumber, 2);
  if (d.isDraft) watermark(doc);

  return doc.output("blob");
}

// ── Utility ────────────────────────────────────────────

async function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")?.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
