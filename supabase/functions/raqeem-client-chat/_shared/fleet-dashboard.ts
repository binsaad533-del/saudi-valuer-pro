/**
 * المستوى 48 — لوحة تحكم العميل للأساطيل (Fleet Client Dashboard)
 * عرض حي لتقدم التقييم مع إحصائيات مرحلية
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface FleetProgress {
  totalAssets: number;
  valuedAssets: number;
  progressPercent: number;
  estimatedCompletionDays: number;
  phasesCompleted: string[];
  currentPhase: string;
}

export interface FleetDashboardResult {
  section: string;
  progress: FleetProgress;
  milestones: { label: string; reached: boolean; date?: string }[];
  exportReady: boolean;
}

export async function generateFleetDashboard(
  db: SupabaseClient,
  assignmentId?: string
): Promise<FleetDashboardResult> {
  const empty: FleetDashboardResult = {
    section: "",
    progress: {
      totalAssets: 0, valuedAssets: 0, progressPercent: 0,
      estimatedCompletionDays: 0, phasesCompleted: [], currentPhase: "",
    },
    milestones: [], exportReady: false,
  };
  if (!assignmentId) return empty;

  try {
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("status, created_at, valuation_mode")
      .eq("id", assignmentId)
      .maybeSingle();
    if (!assignment) return empty;

    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id, status")
      .eq("assignment_id", assignmentId)
      .limit(20);

    const { count: totalAssets } = await db
      .from("extracted_assets")
      .select("id", { count: "exact", head: true })
      .in("job_id", (jobs || []).map(j => j.id));

    if (!totalAssets || totalAssets < 10) return empty;

    const { count: reviewedAssets } = await db
      .from("extracted_assets")
      .select("id", { count: "exact", head: true })
      .in("job_id", (jobs || []).map(j => j.id))
      .not("review_status", "is", null);

    const status = assignment.status as string;
    const statusOrder = [
      "submitted", "scope_generated", "scope_approved", "first_payment_confirmed",
      "data_collection_open", "data_collection_complete",
      "inspection_pending", "inspection_completed", "data_validated",
      "analysis_complete", "professional_review",
      "draft_report_ready", "client_review", "draft_approved",
      "final_payment_confirmed", "issued",
    ];

    const currentIdx = statusOrder.indexOf(status);
    const progressPercent = Math.max(0, Math.round(((currentIdx + 1) / statusOrder.length) * 100));

    const phasesCompleted = statusOrder.slice(0, currentIdx);
    const currentPhase = getPhaseLabel(status);

    // Estimate completion
    const createdAt = new Date(assignment.created_at);
    const daysSoFar = Math.ceil((Date.now() - createdAt.getTime()) / 86400000);
    const remainingPhases = statusOrder.length - currentIdx;
    const avgDaysPerPhase = daysSoFar / Math.max(currentIdx, 1);
    const estimatedDays = Math.ceil(remainingPhases * avgDaysPerPhase);

    const valuedCount = reviewedAssets || 0;

    const milestones = [
      { label: "استلام الطلب", reached: currentIdx >= 0, date: assignment.created_at },
      { label: "اعتماد نطاق العمل", reached: currentIdx >= 2 },
      { label: "بدء التقييم", reached: currentIdx >= 3 },
      { label: "تقييم 25%", reached: valuedCount >= totalAssets * 0.25 },
      { label: "تقييم 50%", reached: valuedCount >= totalAssets * 0.5 },
      { label: "تقييم 75%", reached: valuedCount >= totalAssets * 0.75 },
      { label: "تقييم 100%", reached: valuedCount >= totalAssets },
      { label: "المسودة جاهزة", reached: currentIdx >= 11 },
      { label: "التقرير النهائي", reached: status === "issued" },
    ];

    const exportReady = currentIdx >= 11;

    let section = `\n\n## لوحة تحكم الأسطول\n`;
    section += `- التقدم العام: **${progressPercent}%** `;
    section += progressPercent >= 80 ? "🟢" : progressPercent >= 40 ? "🟡" : "🔴";
    section += `\n- المرحلة الحالية: **${currentPhase}**\n`;
    section += `- الأصول المُقيّمة: **${valuedCount}** من **${totalAssets}** (${Math.round((valuedCount / totalAssets) * 100)}%)\n`;
    section += `- التسليم المتوقع: **${estimatedDays} يوم** متبقي\n`;

    section += `\n### المراحل المكتملة:\n`;
    for (const m of milestones) {
      section += `${m.reached ? "✅" : "⏳"} ${m.label}\n`;
    }

    if (exportReady) {
      section += `\n📥 التقرير جاهز للتصدير (Excel + PDF)\n`;
    }

    return {
      section,
      progress: {
        totalAssets, valuedAssets: valuedCount, progressPercent,
        estimatedCompletionDays: estimatedDays,
        phasesCompleted, currentPhase,
      },
      milestones, exportReady,
    };
  } catch (e) {
    console.error("Fleet dashboard error:", e);
    return empty;
  }
}

function getPhaseLabel(status: string): string {
  const labels: Record<string, string> = {
    submitted: "مقدم",
    scope_generated: "إعداد النطاق",
    scope_approved: "النطاق معتمد",
    first_payment_confirmed: "الدفعة الأولى",
    data_collection_open: "جمع البيانات",
    data_collection_complete: "اكتمال البيانات",
    inspection_pending: "بانتظار المعاينة",
    inspection_completed: "المعاينة مكتملة",
    data_validated: "التحقق من البيانات",
    analysis_complete: "اكتمال التحليل",
    professional_review: "المراجعة المهنية",
    draft_report_ready: "المسودة جاهزة",
    client_review: "مراجعة العميل",
    draft_approved: "المسودة معتمدة",
    final_payment_confirmed: "الدفعة النهائية",
    issued: "صدر التقرير",
  };
  return labels[status] || status;
}
