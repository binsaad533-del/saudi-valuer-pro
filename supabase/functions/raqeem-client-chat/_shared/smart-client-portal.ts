/**
 * Level 54: Smart Client Portal Engine
 * Interactive dashboard data for real-time progress with notifications and ETA
 */

import { getTurnaroundDays, isDesktopMode } from "./valuation-mode.ts";

interface MilestoneStatus {
  stage: string;
  label: string;
  status: "completed" | "active" | "pending" | "blocked";
  completedAt?: string;
  estimatedAt?: string;
  blockReason?: string;
}

interface SmartPortalResult {
  section: string;
  milestones: MilestoneStatus[];
  overallProgress: number;
  estimatedDelivery: string;
  daysRemaining: number;
  notifications: string[];
  satisfaction: { score: number; sentiment: string };
}

export async function analyzeSmartPortal(
  db: any,
  assignmentId: string | undefined,
  requestId: string | undefined
): Promise<SmartPortalResult> {
  const empty: SmartPortalResult = {
    section: "", milestones: [], overallProgress: 0, estimatedDelivery: "",
    daysRemaining: 0, notifications: [], satisfaction: { score: 0, sentiment: "" },
  };
  if (!assignmentId) return empty;

  try {
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("status, created_at, valuation_mode, property_type, updated_at")
      .eq("id", assignmentId)
      .single();

    if (!assignment) return empty;

    // Define milestone sequence
    const allStages = [
      { stage: "submitted", label: "تقديم الطلب" },
      { stage: "scope_generated", label: "إعداد نطاق العمل" },
      { stage: "scope_approved", label: "اعتماد النطاق" },
      { stage: "first_payment_confirmed", label: "الدفعة الأولى" },
      { stage: "data_collection_open", label: "جمع البيانات" },
      { stage: "inspection_pending", label: "المعاينة" },
      { stage: "inspection_completed", label: "اكتمال المعاينة" },
      { stage: "analysis_complete", label: "التحليل والتقييم" },
      { stage: "professional_review", label: "المراجعة المهنية" },
      { stage: "draft_report_ready", label: "مسودة التقرير" },
      { stage: "client_review", label: "مراجعة العميل" },
      { stage: "draft_approved", label: "اعتماد المسودة" },
      { stage: "final_payment_confirmed", label: "الدفعة النهائية" },
      { stage: "issued", label: "إصدار التقرير" },
    ];

    // Skip inspection stages for desktop mode
    const stages = isDesktopMode(assignment.valuation_mode)
      ? allStages.filter((s) => !["inspection_pending", "inspection_completed"].includes(s.stage))
      : allStages;

    const statusIndex = stages.findIndex((s) => s.stage === assignment.status);
    const currentIdx = statusIndex === -1 ? 0 : statusIndex;

    const milestones: MilestoneStatus[] = stages.map((s, i) => ({
      stage: s.stage,
      label: s.label,
      status: i < currentIdx ? "completed" : i === currentIdx ? "active" : "pending",
    }));

    const overallProgress = Math.round(((currentIdx + 1) / stages.length) * 100);

    // ETA calculation
    const createdDate = new Date(assignment.created_at);
    const deliveryDays = getTurnaroundDays(assignment.valuation_mode);
    const estimatedDelivery = new Date(createdDate.getTime() + deliveryDays * 86400000);
    const daysRemaining = Math.max(0, Math.ceil((estimatedDelivery.getTime() - Date.now()) / 86400000));

    // Generate notifications
    const notifications: string[] = [];
    const daysSinceUpdate = Math.ceil((Date.now() - new Date(assignment.updated_at).getTime()) / 86400000);

    if (daysSinceUpdate > 3) {
      notifications.push(`لم يتم تحديث الطلب منذ ${daysSinceUpdate} أيام`);
    }
    if (daysRemaining === 0) {
      notifications.push("حان موعد التسليم المتوقع");
    } else if (daysRemaining <= 2) {
      notifications.push(`متبقي ${daysRemaining} يوم على التسليم`);
    }
    if (assignment.status === "data_collection_open") {
      notifications.push("يُرجى رفع المستندات المتبقية لتسريع العملية");
    }

    // Client satisfaction estimate
    const satisfactionScore = daysRemaining > 0 && daysSinceUpdate < 3 ? 85 : daysSinceUpdate > 5 ? 50 : 70;
    const sentiment = satisfactionScore > 75 ? "إيجابي" : satisfactionScore > 50 ? "محايد" : "يحتاج اهتمام";

    let section = "\n\n## بوابة العميل الذكية (المستوى 54)\n";
    section += `- التقدم: ${overallProgress}% | الحالة: ${stages[currentIdx]?.label || assignment.status}\n`;
    section += `- التسليم المتوقع: ${estimatedDelivery.toLocaleDateString("ar-SA")} (${daysRemaining > 0 ? `${daysRemaining} يوم` : "حان الموعد"})\n`;
    if (notifications.length > 0) section += `- إشعارات: ${notifications.join(" | ")}\n`;
    section += `- رضا العميل المتوقع: ${satisfactionScore}% (${sentiment})\n`;

    return {
      section, milestones, overallProgress,
      estimatedDelivery: estimatedDelivery.toISOString(),
      daysRemaining, notifications,
      satisfaction: { score: satisfactionScore, sentiment },
    };
  } catch (e) {
    console.error("Smart portal error:", e);
    return empty;
  }
}
