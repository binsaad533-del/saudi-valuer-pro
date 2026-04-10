// Valuation tools — extracted from index.ts without logic changes
import { ToolResult, callInternalFunction, buildReportContext, runComplianceCheck } from "./helpers.ts";

// ═══════════════════════════════════════════════════════════
// Pre-Generation Quality Gate — Data Completeness Validation
// ═══════════════════════════════════════════════════════════
interface DataDeficiency {
  field: string;
  label_ar: string;
  severity: "mandatory" | "quality";
}

function validateReportReadiness(context: any): { ready: boolean; deficiencies: DataDeficiency[]; score: number } {
  const deficiencies: DataDeficiency[] = [];

  // ── Mandatory fields (block generation) ──
  const mandatoryChecks: { field: string; label_ar: string; value: any }[] = [
    { field: "assetDescription", label_ar: "وصف الأصل", value: context.assetDescription },
    { field: "assetLocation", label_ar: "موقع الأصل", value: context.assetLocation },
    { field: "methodology", label_ar: "منهجية التقييم", value: context.methodology },
    { field: "purposeOfValuation", label_ar: "غرض التقييم", value: context.purposeOfValuation },
    { field: "clientName", label_ar: "اسم العميل", value: context.clientName },
    { field: "propertyType", label_ar: "نوع العقار", value: context.propertyType },
  ];

  for (const check of mandatoryChecks) {
    if (!check.value || (typeof check.value === "string" && check.value.trim().length < 3)) {
      deficiencies.push({ field: check.field, label_ar: check.label_ar, severity: "mandatory" });
    }
  }

  // ── Quality fields (warn but allow) ──
  const qualityChecks: { field: string; label_ar: string; value: any }[] = [
    { field: "landArea", label_ar: "مساحة الأرض", value: context.landArea },
    { field: "buildingArea", label_ar: "مساحة البناء", value: context.buildingArea },
    { field: "assetCity", label_ar: "المدينة", value: context.assetCity },
    { field: "inspectionSummary", label_ar: "ملخص المعاينة", value: context.inspectionSummary },
    { field: "referenceNumber", label_ar: "الرقم المرجعي", value: context.referenceNumber },
    { field: "inspectionDate", label_ar: "تاريخ المعاينة", value: context.inspectionDate },
  ];

  for (const check of qualityChecks) {
    if (!check.value || (typeof check.value === "string" && check.value.trim().length < 2)) {
      deficiencies.push({ field: check.field, label_ar: check.label_ar, severity: "quality" });
    }
  }

  // Comparables check (mandatory for market approach)
  const isMarketApproach = context.methodology?.includes("مقارنة") || context.methodology?.toLowerCase()?.includes("comparison");
  if (isMarketApproach && (!context.comparables || context.comparables.length < 2)) {
    deficiencies.push({ field: "comparables", label_ar: "المقارنات السوقية (يجب 3 مقارنات على الأقل)", severity: "mandatory" });
  } else if (!context.comparables || context.comparables.length < 1) {
    deficiencies.push({ field: "comparables", label_ar: "المقارنات السوقية", severity: "quality" });
  }

  // Estimated value sanity
  if (context.estimatedValue && context.estimatedValue <= 0) {
    deficiencies.push({ field: "estimatedValue", label_ar: "القيمة التقديرية (يجب أن تكون موجبة)", severity: "mandatory" });
  }

  const mandatoryFails = deficiencies.filter(d => d.severity === "mandatory").length;
  const totalChecks = mandatoryChecks.length + qualityChecks.length + 2;
  const passedChecks = totalChecks - deficiencies.length;
  const score = Math.round((passedChecks / totalChecks) * 100);

  return {
    ready: mandatoryFails === 0,
    deficiencies,
    score,
  };
}

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

    // ═══ PRE-GENERATION QUALITY GATE ═══
    const validation = validateReportReadiness(context);
    if (!validation.ready) {
      const mandatoryMissing = validation.deficiencies
        .filter(d => d.severity === "mandatory")
        .map(d => `• ${d.label_ar}`)
        .join("\n");
      const qualityMissing = validation.deficiencies
        .filter(d => d.severity === "quality")
        .map(d => `• ${d.label_ar}`)
        .join("\n");

      let errorMsg = `⛔ لا يمكن توليد التقرير — البيانات الإلزامية غير مكتملة (${validation.score}% جاهزية)\n\n`;
      errorMsg += `**بيانات إلزامية مفقودة:**\n${mandatoryMissing}`;
      if (qualityMissing) {
        errorMsg += `\n\n**بيانات جودة مفقودة:**\n${qualityMissing}`;
      }
      errorMsg += `\n\nيرجى استكمال البيانات المطلوبة قبل توليد التقرير. يمكنك تحديث بيانات المهمة أو العقار أولاً.`;

      return { success: false, result: { validation }, error: errorMsg, _format: "markdown" };
    }

    // If ready but has quality warnings, include them as metadata
    const qualityWarnings = validation.deficiencies.filter(d => d.severity === "quality");

    const result = await callInternalFunction(supabaseUrl, serviceKey, "generate-report-content", {
      mode: "structured_sections",
      context,
      qualityEnforcement: {
        enabled: true,
        score: validation.score,
        warnings: qualityWarnings.map(w => w.label_ar),
      },
    });

    // ═══ POST-GENERATION QUALITY VALIDATION ═══
    if (result.success && result.result?.data?.sections) {
      const sections = result.result.data.sections;
      const postIssues: string[] = [];

      // Check for placeholder/generic content
      const placeholderPatterns = [/\[.*?\]/g, /TODO/gi, /غير محدد/g, /يرجى إضافة/g, /سيتم تحديد/g];
      for (const [key, value] of Object.entries(sections)) {
        if (typeof value === "string" && value.length > 0) {
          for (const pattern of placeholderPatterns) {
            if (pattern.test(value as string)) {
              postIssues.push(`قسم "${key}" يحتوي على نص مؤقت أو غير مكتمل`);
              break;
            }
          }
          // Check minimum content length
          if ((value as string).length < 50 && !key.endsWith("_en")) {
            postIssues.push(`قسم "${key}" قصير جداً ولا يلبي معايير الجودة المهنية`);
          }
        }
      }

      if (postIssues.length > 0) {
        result.result._qualityWarnings = postIssues;
      }

      if (qualityWarnings.length > 0) {
        result.result._dataWarnings = qualityWarnings.map(w => w.label_ar);
      }
    }

    return result;
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

  if (toolName === "analyze_documents") {
    if (!args.request_id && !args.assignment_id) {
      return { success: false, result: null, error: "تعذر تحديد الطلب الحالي لتحليل المستندات" };
    }

    const requestId = args.request_id;
    const assignmentId = args.assignment_id;

    // Gather attachments
    const attachmentQueries = [];
    if (assignmentId) {
      attachmentQueries.push(
        db.from("attachments")
          .select("file_name, file_path, mime_type, description_ar")
          .eq("assignment_id", assignmentId)
          .limit(30)
      );
    }
    if (requestId) {
      attachmentQueries.push(
        db.from("attachments")
          .select("file_name, file_path, mime_type, description_ar")
          .or(`subject_id.eq.${requestId},assignment_id.eq.${requestId}`)
          .limit(30)
      );
    }

    const attachmentResults = await Promise.all(attachmentQueries);
    const allAttachments = attachmentResults.flatMap((res: any) => res.data || []);
    const uniqueAttachments = allAttachments.filter((a: any, i: number, arr: any[]) =>
      arr.findIndex((x: any) => x.file_path === a.file_path) === i
    );

    if (uniqueAttachments.length === 0) {
      return { success: false, result: null, error: "لا توجد مستندات مرفوعة لهذا الطلب" };
    }

    // Get organization_id
    let orgId = null;
    if (assignmentId) {
      const { data: asg } = await db.from("valuation_assignments").select("organization_id").eq("id", assignmentId).maybeSingle();
      orgId = asg?.organization_id;
    }

    return await callInternalFunction(supabaseUrl, serviceKey, "analyze-documents", {
      requestId,
      assignmentId,
      organizationId: orgId,
      storagePaths: uniqueAttachments.map((a: any) => ({
        path: a.file_path,
        name: a.file_name,
        mimeType: a.mime_type,
      })),
    });
  }

  return null; // Not handled by this module
}
