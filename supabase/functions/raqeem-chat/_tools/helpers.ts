// Shared helpers - extracted from index.ts without any logic changes
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ToolResult = { success: boolean; result: any; error?: string; _format?: string };

export async function resolveIdsFromContext(
  db: ReturnType<typeof createClient>,
  platformContext: any,
  rawArgs: any,
): Promise<any> {
  const args = { ...(rawArgs || {}) };
  const pc = platformContext && typeof platformContext === "object" ? platformContext : {};

  if (!args.assignment_id && pc.assignment_id) args.assignment_id = pc.assignment_id;
  if (!args.request_id && pc.request_id) args.request_id = pc.request_id;
  if (!args.reference_number && pc.reference_number) args.reference_number = pc.reference_number;

  if (!args.request_id && args.assignment_id) {
    const { data: requestLink } = await db
      .from("valuation_requests")
      .select("id")
      .eq("assignment_id", args.assignment_id)
      .maybeSingle();
    if (requestLink?.id) args.request_id = requestLink.id;
  }

  if (!args.assignment_id && args.request_id) {
    const { data: assignmentLink } = await db
      .from("valuation_requests")
      .select("assignment_id")
      .eq("id", args.request_id)
      .maybeSingle();
    if (assignmentLink?.assignment_id) args.assignment_id = assignmentLink.assignment_id;
  }

  if (!args.assignment_id && args.reference_number) {
    const { data: assignmentByRef } = await db
      .from("valuation_assignments")
      .select("id, reference_number")
      .ilike("reference_number", `%${args.reference_number}%`)
      .maybeSingle();
    if (assignmentByRef?.id) {
      args.assignment_id = assignmentByRef.id;
      args.reference_number = assignmentByRef.reference_number || args.reference_number;
    }
  }

  if (!args.request_id && args.assignment_id) {
    const { data: requestLink } = await db
      .from("valuation_requests")
      .select("id")
      .eq("assignment_id", args.assignment_id)
      .maybeSingle();
    if (requestLink?.id) args.request_id = requestLink.id;
  }

  if (!args.reference_number && args.assignment_id) {
    const { data: assignmentMeta } = await db
      .from("valuation_assignments")
      .select("reference_number")
      .eq("id", args.assignment_id)
      .maybeSingle();
    if (assignmentMeta?.reference_number) args.reference_number = assignmentMeta.reference_number;
  }

  return args;
}

export async function callInternalFunction(
  supabaseUrl: string,
  serviceKey: string,
  functionName: string,
  body: any
): Promise<ToolResult> {
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

export async function buildReportContext(db: any, assignmentId: string) {
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

export async function runComplianceCheck(db: any, assignmentId: string) {
  const checks: { check: string; passed: boolean; note: string }[] = [];

  const { data: assignment } = await db.from("valuation_assignments").select("*").eq("id", assignmentId).single();
  if (!assignment) {
    return { passed: false, score: 0, checks: [{ check: "وجود المهمة", passed: false, note: "لم يتم العثور على مهمة التقييم" }] };
  }

  const { data: subjects } = await db.from("subjects").select("*").eq("assignment_id", assignmentId);
  const hasSubject = subjects && subjects.length > 0;
  checks.push({ check: "بيانات العقار محل التقييم", passed: !!hasSubject, note: hasSubject ? `${subjects.length} عقار مسجل` : "لا توجد بيانات عقار" });

  const subject = hasSubject ? subjects[0] : null;
  checks.push({ check: "الموقع (المدينة)", passed: !!subject?.city_ar, note: subject?.city_ar || "غير محدد" });
  checks.push({ check: "المساحة", passed: !!(subject?.land_area || subject?.building_area), note: subject?.land_area ? `${subject.land_area} م²` : "غير محددة" });

  const { data: comps } = await db.from("assignment_comparables").select("id").eq("assignment_id", assignmentId);
  const compCount = comps?.length || 0;
  checks.push({ check: "المقارنات (≥3 مطلوبة)", passed: compCount >= 3, note: `${compCount} مقارنات` });

  const { data: assumptions } = await db.from("assumptions").select("id").eq("assignment_id", assignmentId);
  checks.push({ check: "الافتراضات والمحددات", passed: !!(assumptions?.length), note: assumptions?.length ? `${assumptions.length} بند` : "لم تُسجل" });

  checks.push({ check: "المنهجية", passed: !!assignment.methodology, note: assignment.methodology || "غير محددة" });
  checks.push({ check: "القيمة النهائية", passed: !!assignment.final_value, note: assignment.final_value ? `${Number(assignment.final_value).toLocaleString()} ر.س` : "غير محددة" });

  const { data: reports } = await db.from("reports").select("id").eq("assignment_id", assignmentId);
  checks.push({ check: "وجود التقرير", passed: !!(reports?.length), note: reports?.length ? "موجود" : "لم يُنشأ" });

  if (assignment.valuation_mode !== "desktop") {
    const { data: inspections } = await db.from("inspections").select("completed, status").eq("assignment_id", assignmentId);
    const inspDone = inspections?.some((i: any) => i.completed || i.status === "completed");
    checks.push({ check: "المعاينة الميدانية", passed: !!inspDone, note: inspDone ? "مكتملة" : "غير مكتملة" });
  }

  const passedCount = checks.filter(c => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);

  return { passed: score >= 80, score, checks };
}
