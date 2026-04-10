/**
 * PDF Security Layer
 * Adds visible + forensic watermarks, per-recipient tracking, and protection metadata.
 */
import jsPDF from "jspdf";

export interface PdfRecipientInfo {
  name: string;
  email: string;
  userId: string;
  timestamp: string;
  sessionId: string;
}

/**
 * Add visible watermark to every page of the PDF
 */
export function addVisibleWatermark(doc: jsPDF, recipient: PdfRecipientInfo) {
  const pageCount = doc.getNumberOfPages();
  const { name, email, timestamp, sessionId } = recipient;
  const watermarkLine = `${name} | ${email} | ${timestamp} | ${sessionId}`;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Diagonal tiled watermark
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(10);

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const x = 20 + col * (pw / 3);
        const y = 40 + row * (ph / 5);
        doc.text(watermarkLine, x, y, { angle: 30 });
      }
    }

    // Bottom strip with recipient info
    doc.setFillColor(0, 0, 0);
    doc.setGlobalAlpha?.(0.05);
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `نسخة مرخصة لـ: ${name} (${email}) — ${timestamp} — معرف: ${sessionId}`,
      pw / 2,
      ph - 5,
      { align: "center" }
    );
  }
}

/**
 * Add forensic (invisible) watermark using micro-text and metadata
 * Each copy has unique invisible markers for leak tracing.
 */
export function addForensicWatermark(doc: jsPDF, recipient: PdfRecipientInfo) {
  const pageCount = doc.getNumberOfPages();
  const forensicId = `FRN-${recipient.userId.slice(0, 8)}-${Date.now().toString(36)}`;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();

    // Micro-text at near-invisible size (1pt) scattered across pages
    doc.setFontSize(1);
    doc.setTextColor(252, 252, 252); // Nearly white - invisible on white paper

    // Place forensic markers at specific computed positions per page
    const positions = [
      { x: 15 + (i * 7) % 30, y: 25 + (i * 13) % 40 },
      { x: pw - 20 - (i * 11) % 25, y: 60 + (i * 17) % 50 },
      { x: 30 + (i * 5) % 40, y: 200 + (i * 9) % 30 },
      { x: pw / 2 + (i * 3) % 20, y: 150 + (i * 7) % 40 },
    ];

    positions.forEach((pos) => {
      doc.text(forensicId, pos.x, pos.y);
    });
  }

  // Embed forensic ID in PDF metadata
  doc.setProperties({
    title: doc.getProperties?.()?.title || "Valuation Report",
    subject: `Licensed copy: ${recipient.email}`,
    author: "Jassas Valuation",
    keywords: forensicId,
    creator: `JSAAS-DRM-${forensicId}`,
  });
}

/**
 * Apply full PDF protection: visible + forensic watermarks + metadata
 */
export function applyPdfProtection(doc: jsPDF, recipient: PdfRecipientInfo) {
  addVisibleWatermark(doc, recipient);
  addForensicWatermark(doc, recipient);
}

/**
 * Generate a unique session-bound download token
 */
export function generateDownloadToken(): string {
  return `DL-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`.toUpperCase();
}
