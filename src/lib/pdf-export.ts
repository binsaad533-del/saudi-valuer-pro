import { supabase } from "@/integrations/supabase/client";
import type { ReportData, ReportLanguage } from "@/lib/report-types";

export interface PdfExportOptions {
  reportData: ReportData;
  language: ReportLanguage;
  isDraft: boolean;
  signatureUrl?: string | null;
  assignmentId?: string;
  reportId?: string;
}

export async function exportReportPdf(options: PdfExportOptions): Promise<{ url: string; json: any }> {
  const { reportData, language, isDraft, signatureUrl, assignmentId, reportId } = options;

  // If we have assignment_id and report_id, use the edge function
  if (assignmentId && reportId) {
    const { data, error } = await supabase.functions.invoke("generate-report-pdf", {
      body: {
        assignment_id: assignmentId,
        report_id: reportId,
        type: isDraft ? "draft" : "final",
      },
    });

    if (error) throw new Error(error.message || "فشل في إنشاء التقرير");
    return { url: data.report_url, json: data.report_json };
  }

  // Local JSON export fallback for preview mode
  const reportJson = {
    metadata: {
      type: isDraft ? "DRAFT" : "FINAL",
      reference_number: reportData.reference_number,
      report_date: reportData.report_date,
      valuation_date: reportData.valuation_date,
      language,
      watermark: isDraft ? "DRAFT / مسودة" : null,
    },
    cover: {
      title_ar: reportData.cover_title_ar,
      title_en: reportData.cover_title_en,
      client: {
        name_ar: reportData.client_name_ar,
        name_en: reportData.client_name_en,
        id_number: reportData.client_id_number,
      },
    },
    final_value: reportData.final_value,
    currency: reportData.currency,
    signature: signatureUrl ? { image_url: signatureUrl } : null,
    qr_code: !isDraft ? `${window.location.origin}/verify/${reportData.reference_number}` : null,
  };

  // Download as JSON file
  const blob = new Blob([JSON.stringify(reportJson, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  return { url, json: reportJson };
}

export function downloadBlob(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
