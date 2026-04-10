// Valuation tools — extracted from index.ts without logic changes
import { ToolResult, callInternalFunction, buildReportContext, runComplianceCheck } from "./helpers.ts";

export async function execute(
  toolName: string,
  args: any,
  db: any,
  supabaseUrl: string,
  serviceKey: string,
): Promise<ToolResult | null> {

  if (toolName === "generate_scope") {
    if (!args.request_id) {
      return { success: false, result: null, error: "تعذر تحديد request_id من السياق الحالي أو المعرفات المتاحة" };
    }
    return await callInternalFunction(supabaseUrl, serviceKey, "generate-scope-pricing", { requestId: args.request_id });
  }

  if (toolName === "run_valuation") {
    return await callInternalFunction(supabaseUrl, serviceKey, "valuation-engine", { assignmentId: args.assignment_id, step: args.step || "full" });
  }

  if (toolName === "generate_report") {
    const context = await buildReportContext(db, args.assignment_id);
    if (!context) {
      return { success: false, result: null, error: "لم يتم العثور على مهمة التقييم" };
    }
    return await callInternalFunction(supabaseUrl, serviceKey, "generate-report-content", {
      mode: "structured_sections",
      context,
    });
  }

  if (toolName === "check_compliance") {
    const complianceResult = await runComplianceCheck(db, args.assignment_id);
    return { success: true, result: complianceResult };
  }

  if (toolName === "extract_documents") {
    if (!args.request_id && !args.assignment_id) {
      return { success: false, result: null, error: "تعذر تحديد الطلب الحالي لاستخراج المستندات" };
    }

    const requestId = args.request_id;
    const assignmentId = args.assignment_id;

    const attachmentQueries = [];
    if (assignmentId) {
      attachmentQueries.push(
        db.from("attachments")
          .select("file_name, file_path, mime_type, description_ar")
          .eq("assignment_id", assignmentId)
          .limit(20)
      );
    }
    if (requestId) {
      attachmentQueries.push(
        db.from("attachments")
          .select("file_name, file_path, mime_type, description_ar")
          .or(`subject_id.eq.${requestId},assignment_id.eq.${requestId}`)
          .limit(20)
      );
    }

    const attachmentResults = await Promise.all(attachmentQueries);
    const allAttachments = attachmentResults.flatMap((res: any) => res.data || []);
    const uniqueAttachments = allAttachments.filter((a: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.file_path === a.file_path) === i);

    if (uniqueAttachments.length === 0) {
      return { success: false, result: null, error: "لا توجد مستندات مرفوعة لهذا الطلب" };
    }

    return await callInternalFunction(supabaseUrl, serviceKey, "extract-documents", {
      requestId,
      fileNames: uniqueAttachments.map((a: any) => a.file_name),
      fileDescriptions: uniqueAttachments.map((a: any) => a.description_ar || a.file_name),
      storagePaths: uniqueAttachments.map((a: any) => ({ path: a.file_path, mimeType: a.mime_type })),
    });
  }

  if (toolName === "translate_report") {
    const { data: reports } = await db
      .from("report_versions")
      .select("content_json")
      .eq("assignment_id", args.assignment_id)
      .order("version_number", { ascending: false })
      .limit(1);

    const content = reports?.[0]?.content_json;
    if (!content) {
      return { success: false, result: null, error: "لا يوجد تقرير لهذه المهمة" };
    }

    const sourceLang = args.target_lang === "en" ? "ar" : "en";
    const sections = typeof content === "object" ? content : {};

    return await callInternalFunction(supabaseUrl, serviceKey, "translate-report", {
      sections,
      sourceLang,
      targetLang: args.target_lang,
    });
  }

  if (toolName === "check_consistency") {
    const { data: reports } = await db
      .from("report_versions")
      .select("content_json, language")
      .eq("assignment_id", args.assignment_id)
      .order("version_number", { ascending: false })
      .limit(2);

    if (!reports || reports.length === 0) {
      return { success: false, result: null, error: "لا يوجد تقرير لفحص التطابق" };
    }

    const arReport = reports.find((r: any) => r.language === "ar")?.content_json;
    const enReport = reports.find((r: any) => r.language === "en")?.content_json;

    return await callInternalFunction(supabaseUrl, serviceKey, "check-consistency", {
      arabic_conclusion: arReport?.conclusion || arReport?.reconciliation || "",
      english_conclusion: enReport?.conclusion || enReport?.reconciliation || "",
      arabic_value: arReport?.final_value,
      english_value: enReport?.final_value,
    });
  }

  return null; // Not handled by this module
}
