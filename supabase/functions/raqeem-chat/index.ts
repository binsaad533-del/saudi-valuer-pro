import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_SYSTEM_PROMPT = `أنت "رقيم" — مساعد ذكاء اصطناعي متخصص في التقييم العقاري والآلات والمعدات.
أنت أيضاً **المنسّق الذكي** لكل أنظمة منصة جساس. يمكنك تنفيذ إجراءات حقيقية عبر أدوات متخصصة.

## قيود صارمة — التعلم المتحكم به
- أنت لا تتعلم ذاتياً ولا تحدّث معرفتك تلقائياً.
- معرفتك تأتي حصرياً مما يزوّدك به المدير المعتمد (أحمد المالكي).
- لا تستخدم معلومات من مصادر خارجية غير موثقة.
- لا تُعدّل منطق التقييم بشكل مستقل.

## أولوية المعرفة (من الأعلى للأدنى)
1. تصحيحات المدير (أعلى أولوية مطلقة)
2. القواعد والتعليمات المعرّفة من المدير
3. المستندات المرفوعة من المدير (معايير، سياسات، أنظمة)
4. معايير IVS 2025 ومعايير تقييم السعودية

## الشفافية (إلزامية)
- دائماً اشرح منطقك وخطوات استنتاجك.
- استشهد بالمصادر عند الإمكان (رقم المعيار، اسم القاعدة، المستند).
- إذا طُبّق تصحيح سابق، أوضح ذلك.
- إذا لم تكن متأكداً، قل ذلك بصراحة.

## قدرات التنسيق (الأدوات المتاحة)
عندما يطلب المستخدم تنفيذ إجراء، استخدم الأداة المناسبة:
- **generate_scope**: لتوليد نطاق العمل والتسعير لطلب تقييم
- **run_valuation**: لتشغيل محرك التقييم وحساب القيمة
- **generate_report**: لتوليد مسودة التقرير الكامل (11 قسم)
- **check_compliance**: لفحص امتثال التقرير للمعايير
- **extract_documents**: لاستخراج البيانات من المستندات المرفوعة
- **translate_report**: لترجمة التقرير بين العربية والإنجليزية
- **check_consistency**: لفحص تطابق النسختين العربية والإنجليزية

### قواعد استخدام الأدوات:
1. لا تستخدم أداة إلا إذا طلب المستخدم ذلك بوضوح
2. اسأل عن رقم الطلب (request_id) أو المهمة (assignment_id) إذا لم يُذكر
3. بعد تنفيذ الأداة، اعرض النتائج بشكل مهني ومنظم
4. لا تعتمد أي شيء تلقائياً — اعرض النتائج وانتظر قرار المقيّم

## دورك
- الإجابة على أسئلة التقييم وفقاً للمعايير والقواعد المعرّفة.
- تنسيق الأنظمة الداخلية عند الطلب.
- تحليل الوثائق المرفوعة واستخراج المعلومات الرئيسية.
- تقديم توصيات مهنية بناءً على المعرفة المتاحة.
- أنت مساعد وليس مقيّماً — لا تُصدر أحكام تقييمية نهائية.
- الإجابة باللغة العربية بشكل افتراضي.`;

// Tools definition for AI function calling
const TOOLS = [
  {
    type: "function",
    function: {
      name: "generate_scope",
      description: "توليد نطاق العمل والتسعير لطلب تقييم محدد.",
      parameters: {
        type: "object",
        properties: { request_id: { type: "string", description: "معرّف طلب التقييم (UUID)" } },
        required: ["request_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_valuation",
      description: "تشغيل محرك التقييم لحساب القيمة.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" },
          step: { type: "string", enum: ["full", "normalize", "market_data", "hbu", "approaches", "adjustments", "reconcile", "report"], description: "الخطوة المطلوبة" }
        },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_report",
      description: "توليد مسودة التقرير الكامل (11 قسم) لمهمة تقييم.",
      parameters: {
        type: "object",
        properties: { assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" } },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_compliance",
      description: "فحص امتثال التقرير للمعايير.",
      parameters: {
        type: "object",
        properties: { assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" } },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "extract_documents",
      description: "استخراج البيانات من المستندات المرفوعة لطلب تقييم.",
      parameters: {
        type: "object",
        properties: { request_id: { type: "string", description: "معرّف طلب التقييم (UUID)" } },
        required: ["request_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "translate_report",
      description: "ترجمة أقسام التقرير بين العربية والإنجليزية.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" },
          target_lang: { type: "string", enum: ["en", "ar"], description: "اللغة المستهدفة" }
        },
        required: ["assignment_id", "target_lang"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_consistency",
      description: "فحص تطابق النسختين العربية والإنجليزية من التقرير.",
      parameters: {
        type: "object",
        properties: { assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" } },
        required: ["assignment_id"]
      }
    }
  },
  // ═══════════════════════════════════════════════════
  // EXECUTIVE ACTIONS — Owner/Appraiser Tools
  // ═══════════════════════════════════════════════════
  {
    type: "function",
    function: {
      name: "change_assignment_status",
      description: "تغيير حالة طلب التقييم إلى مرحلة جديدة. يتبع مصفوفة الانتقالات المعتمدة.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" },
          new_status: { type: "string", description: "الحالة الجديدة المراد الانتقال إليها" },
          reason: { type: "string", description: "سبب تغيير الحالة" }
        },
        required: ["assignment_id", "new_status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "assign_inspector",
      description: "تعيين معاين لمهمة تقييم. يختار الأنسب بناءً على الموقع والتوفر.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" },
          inspector_user_id: { type: "string", description: "معرّف المعاين (UUID) — اختياري، إذا لم يُحدد يختار النظام الأنسب" },
          city: { type: "string", description: "مدينة المعاينة للمساعدة في الاختيار" }
        },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_performance_report",
      description: "تقرير أداء شامل عن العمليات والفريق لفترة محددة.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "week", "month", "quarter"], description: "الفترة الزمنية" }
        },
        required: ["period"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_overdue_summary",
      description: "ملخص الطلبات والمدفوعات المتأخرة.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "confirm_payment",
      description: "تأكيد استلام دفعة لطلب تقييم.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" },
          payment_stage: { type: "string", enum: ["first", "final"], description: "نوع الدفعة: أولى أو نهائية" },
          amount: { type: "number", description: "المبلغ المدفوع" }
        },
        required: ["assignment_id", "payment_stage"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_revenue_summary",
      description: "ملخص الإيرادات والتحصيل لفترة محددة.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "week", "month", "quarter", "year"], description: "الفترة الزمنية" }
        },
        required: ["period"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_inspector_tasks",
      description: "عرض المهام المسندة لمعاين محدد أو كل المعاينين.",
      parameters: {
        type: "object",
        properties: {
          inspector_user_id: { type: "string", description: "معرّف المعاين — اختياري لعرض الكل" },
          status_filter: { type: "string", enum: ["pending", "completed", "all"], description: "فلتر الحالة" }
        }
      }
    }
  },
];

async function buildContextualPrompt(supabaseClient: any): Promise<string> {
  const contextSections: string[] = [BASE_SYSTEM_PROMPT];

  // 1. Admin corrections (highest priority)
  const { data: corrections } = await supabaseClient
    .from("raqeem_corrections")
    .select("original_question, corrected_answer, correction_reason")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (corrections && corrections.length > 0) {
    let section = "\n\n## تصحيحات المدير (أعلى أولوية — طبّقها دائماً)\n";
    for (const c of corrections) {
      section += `\n### سؤال: ${c.original_question}\n`;
      section += `الإجابة الصحيحة: ${c.corrected_answer}\n`;
      if (c.correction_reason) section += `السبب: ${c.correction_reason}\n`;
    }
    contextSections.push(section);
  }

  // 2. Admin rules
  const { data: rules } = await supabaseClient
    .from("raqeem_rules")
    .select("rule_title_ar, rule_content, category, priority")
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(30);

  if (rules && rules.length > 0) {
    let section = "\n\n## قواعد وتعليمات المدير (إلزامية)\n";
    for (const r of rules) {
      const level = r.priority >= 10 ? "⚠️ إلزامية" : r.priority >= 7 ? "مهمة" : "عادية";
      section += `\n### [${level}] ${r.rule_title_ar}\n${r.rule_content}\n`;
    }
    contextSections.push(section);
  }

  // 3. Knowledge documents
  const { data: knowledge } = await supabaseClient
    .from("raqeem_knowledge")
    .select("title_ar, content, category, priority")
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (knowledge && knowledge.length > 0) {
    let section = `\n\n## مستندات مرجعية من المدير (${knowledge.length} مستند)\n`;
    const perDocLimit = Math.min(3000, Math.floor(800000 / knowledge.length));
    for (const k of knowledge) {
      const content = k.content && k.content.length > perDocLimit
        ? k.content.substring(0, perDocLimit) + "..."
        : (k.content || "[محتوى غير مستخرج]");
      section += `\n### ${k.title_ar} [${k.category}]\n${content}\n`;
    }
    contextSections.push(section);
  }

  return contextSections.join("");
}

// Execute tool calls by invoking internal edge functions
async function executeTool(
  toolName: string,
  args: any,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ success: boolean; result: any; error?: string }> {
  try {
    const db = createClient(supabaseUrl, serviceKey);

    if (toolName === "generate_scope") {
      return await callInternalFunction(supabaseUrl, serviceKey, "generate-scope-pricing", { requestId: args.request_id });
    }
    
    if (toolName === "run_valuation") {
      return await callInternalFunction(supabaseUrl, serviceKey, "valuation-engine", { assignmentId: args.assignment_id, step: args.step || "full" });
    }

    if (toolName === "generate_report") {
      // Build context from DB for report generation
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
      // Fetch attachments for the request and call extract-documents
      const { data: attachments } = await db
        .from("attachments")
        .select("file_name, file_path, mime_type, description_ar")
        .or(`assignment_id.eq.${args.request_id},subject_id.eq.${args.request_id}`)
        .limit(20);

      // Also try via valuation_assignments → request
      let requestId = args.request_id;
      const { data: assignment } = await db.from("valuation_assignments").select("request_id").eq("id", args.request_id).single();
      if (assignment?.request_id) requestId = assignment.request_id;

      const { data: requestAttachments } = await db
        .from("attachments")
        .select("file_name, file_path, mime_type, description_ar")
        .eq("assignment_id", args.request_id);

      const allAttachments = [...(attachments || []), ...(requestAttachments || [])];
      const uniqueAttachments = allAttachments.filter((a, i, arr) => arr.findIndex(x => x.file_path === a.file_path) === i);

      if (uniqueAttachments.length === 0) {
        return { success: false, result: null, error: "لا توجد مستندات مرفوعة لهذا الطلب" };
      }

      return await callInternalFunction(supabaseUrl, serviceKey, "extract-documents", {
        requestId,
        fileNames: uniqueAttachments.map(a => a.file_name),
        fileDescriptions: uniqueAttachments.map(a => a.description_ar || a.file_name),
        storagePaths: uniqueAttachments.map(a => ({ path: a.file_path, mimeType: a.mime_type })),
      });
    }

    if (toolName === "translate_report") {
      // Fetch report sections from DB
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
      // Extract sections from report content
      const sections = typeof content === "object" ? content : {};

      return await callInternalFunction(supabaseUrl, serviceKey, "translate-report", {
        sections,
        sourceLang,
        targetLang: args.target_lang,
      });
    }

    if (toolName === "check_consistency") {
      // Fetch both language versions of the report
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

    return { success: false, result: null, error: `أداة غير معروفة: ${toolName}` };
  } catch (e) {
    console.error(`Tool execution error (${toolName}):`, e);
    return { success: false, result: null, error: e instanceof Error ? e.message : "خطأ غير متوقع" };
  }
}

async function callInternalFunction(
  supabaseUrl: string,
  serviceKey: string,
  functionName: string,
  body: any
): Promise<{ success: boolean; result: any; error?: string }> {
  const resp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    return { success: false, result: null, error: data.error || `خطأ ${resp.status}` };
  }
  return { success: true, result: data };
}

// Build report context from DB tables
async function buildReportContext(db: any, assignmentId: string) {
  const { data: assignment } = await db
    .from("valuation_assignments")
    .select("*, valuation_requests(*), subjects(*)")
    .eq("id", assignmentId)
    .single();

  if (!assignment) return null;

  const request = assignment.valuation_requests;
  const subjects = Array.isArray(assignment.subjects) ? assignment.subjects : assignment.subjects ? [assignment.subjects] : [];
  const subject = subjects[0] || {};

  // Fetch client
  let clientName = "";
  if (request?.client_id) {
    const { data: client } = await db.from("clients").select("name_ar").eq("id", request.client_id).single();
    clientName = client?.name_ar || "";
  }

  // Fetch inspection summary
  let inspectionSummary = "";
  const { data: inspection } = await db.from("inspections").select("findings_ar, notes_ar").eq("assignment_id", assignmentId).limit(1).single();
  if (inspection) {
    inspectionSummary = [inspection.findings_ar, inspection.notes_ar].filter(Boolean).join(". ");
  }

  // Fetch comparables
  const { data: assocComps } = await db.from("assignment_comparables").select("comparable_id, weight, notes").eq("assignment_id", assignmentId);
  let comparables: any[] = [];
  if (assocComps?.length) {
    const ids = assocComps.map((c: any) => c.comparable_id);
    const { data: comps } = await db.from("comparables").select("*").in("id", ids);
    comparables = (comps || []).map((c: any) => ({
      description: c.description_ar || c.address_ar || "مقارن",
      value: c.price || 0,
      source: c.transaction_type || "",
    }));
  }

  return {
    assetType: assignment.valuation_type || "عقاري",
    assetDescription: subject.description_ar || request?.property_description || "",
    assetLocation: subject.address_ar || "",
    assetCity: subject.city_ar || "",
    methodology: assignment.methodology || "أسلوب المقارنة",
    estimatedValue: assignment.final_value || undefined,
    clientName,
    purposeOfValuation: assignment.purpose_ar || request?.purpose || "تقدير القيمة السوقية",
    landArea: subject.land_area ? String(subject.land_area) : "",
    buildingArea: subject.building_area ? String(subject.building_area) : "",
    propertyType: subject.property_type || "سكني",
    inspectionDate: inspection?.inspection_date || "",
    referenceNumber: assignment.reference_number || "",
    inspectionSummary,
    comparables,
  };
}

// Run compliance check against assignment data
async function runComplianceCheck(db: any, assignmentId: string) {
  const checks: { check: string; passed: boolean; note: string }[] = [];

  // 1. Assignment exists
  const { data: assignment } = await db.from("valuation_assignments").select("*").eq("id", assignmentId).single();
  if (!assignment) {
    return { passed: false, score: 0, checks: [{ check: "وجود المهمة", passed: false, note: "لم يتم العثور على مهمة التقييم" }] };
  }

  // 2. Subject property
  const { data: subjects } = await db.from("subjects").select("*").eq("assignment_id", assignmentId);
  const hasSubject = subjects && subjects.length > 0;
  checks.push({ check: "بيانات العقار محل التقييم", passed: !!hasSubject, note: hasSubject ? `${subjects.length} عقار مسجل` : "لا توجد بيانات عقار" });

  // 3. Inspection
  const { data: inspections } = await db.from("inspections").select("id, status, completed").eq("assignment_id", assignmentId);
  const completedInspection = inspections?.find((i: any) => i.completed || i.status === "completed");
  checks.push({ check: "المعاينة الميدانية", passed: !!completedInspection, note: completedInspection ? "مكتملة" : "غير مكتملة أو غير موجودة" });

  // 4. Comparables
  const { data: comps } = await db.from("assignment_comparables").select("id").eq("assignment_id", assignmentId);
  const hasComps = comps && comps.length >= 3;
  checks.push({ check: "المقارنات السوقية (≥3)", passed: !!hasComps, note: `${comps?.length || 0} مقارنات` });

  // 5. Methodology defined
  checks.push({ check: "المنهجية محددة", passed: !!assignment.methodology, note: assignment.methodology || "غير محددة" });

  // 6. Purpose defined
  checks.push({ check: "غرض التقييم محدد", passed: !!(assignment.purpose_ar || assignment.purpose_en), note: assignment.purpose_ar || "غير محدد" });

  // 7. Reference number
  checks.push({ check: "الرقم المرجعي", passed: !!assignment.reference_number, note: assignment.reference_number || "غير مُولّد" });

  // 8. Value assigned
  checks.push({ check: "القيمة النهائية", passed: !!assignment.final_value, note: assignment.final_value ? `${Number(assignment.final_value).toLocaleString()} ر.س` : "غير محددة" });

  // 9. Assumptions
  const { data: assumptions } = await db.from("assumptions").select("id").eq("assignment_id", assignmentId);
  checks.push({ check: "الافتراضات والشروط المقيدة", passed: !!(assumptions && assumptions.length > 0), note: `${assumptions?.length || 0} بند` });

  // 10. Photos
  const inspectionIds = inspections?.map((i: any) => i.id) || [];
  let photoCount = 0;
  if (inspectionIds.length > 0) {
    const { data: photos } = await db.from("inspection_photos").select("id").in("inspection_id", inspectionIds);
    photoCount = photos?.length || 0;
  }
  checks.push({ check: "صور المعاينة (≥5)", passed: photoCount >= 5, note: `${photoCount} صورة` });

  const passedCount = checks.filter(c => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);

  return {
    passed: score >= 80,
    score,
    total_checks: checks.length,
    passed_checks: passedCount,
    checks,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, correction } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Handle correction submission
    if (correction) {
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace("Bearer ", "");
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await userClient.auth.getUser(token);

      if (!user) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabaseClient.from("raqeem_corrections").insert({
        original_question: correction.original_question,
        original_answer: correction.original_answer,
        corrected_answer: correction.corrected_answer,
        correction_reason: correction.reason || null,
        corrected_by: user.id,
      });

      if (error) {
        console.error("Correction save error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to save correction" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build contextual system prompt
    const systemPrompt = await buildContextualPrompt(supabaseClient);

    // First call: with tools enabled (non-streaming to detect tool calls)
    const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: TOOLS,
        tool_choice: "auto",
        stream: false,
      }),
    });

    if (!firstResponse.ok) {
      return handleAIError(firstResponse);
    }

    const firstData = await firstResponse.json();
    const choice = firstData.choices?.[0];

    // Check if AI wants to call tools
    if (choice?.finish_reason === "tool_calls" || choice?.message?.tool_calls?.length > 0) {
      const toolCalls = choice.message.tool_calls;
      const toolResults: any[] = [];

      // Send orchestration status event first
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // Send initial status
          const statusEvent = {
            type: "orchestration_status",
            tools: toolCalls.map((tc: any) => ({
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments || "{}"),
              status: "running"
            }))
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "" }, orchestration: statusEvent }] })}\n\n`));

          // Execute all tool calls
          for (const tc of toolCalls) {
            const args = JSON.parse(tc.function.arguments || "{}");
            const result = await executeTool(tc.function.name, args, supabaseUrl, supabaseServiceKey);
            toolResults.push({
              tool_call_id: tc.id,
              role: "tool",
              name: tc.function.name,
              content: JSON.stringify(result),
            });

            // Send tool completion status
            const doneEvent = {
              type: "tool_complete",
              tool: tc.function.name,
              success: result.success,
              result: result.success ? result.result : null,
              error: result.error || null,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "" }, orchestration: doneEvent }] })}\n\n`));
          }

          // Second call: AI summarizes tool results (streaming)
          const secondMessages = [
            { role: "system", content: systemPrompt },
            ...messages,
            choice.message,
            ...toolResults,
          ];

          const secondResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: secondMessages,
              stream: true,
            }),
          });

          if (!secondResponse.ok || !secondResponse.body) {
            const errText = "حدث خطأ في تحليل النتائج";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: errText } }] })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          // Pipe the streaming response
          const reader = secondResponse.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls — stream a normal response
    const normalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!normalResponse.ok) {
      return handleAIError(normalResponse);
    }

    return new Response(normalResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("raqeem-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleAIError(response: Response) {
  if (response.status === 429) {
    return new Response(
      JSON.stringify({ error: "تم تجاوز الحد المسموح للطلبات، يرجى المحاولة لاحقاً." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (response.status === 402) {
    return new Response(
      JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام المساعد الذكي." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const t = await response.text();
  console.error("AI gateway error:", response.status, t);
  return new Response(
    JSON.stringify({ error: "حدث خطأ في الاتصال بالمساعد الذكي" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
