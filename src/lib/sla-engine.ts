/**
 * SLA Engine — حساب وتتبع مؤشرات الأداء والالتزام بالمواعيد
 */

export interface SLAConfig {
  inspectionHours: number;
  reportHours: number;
  totalDays: number;
}

export interface SLAResult {
  status: "on_track" | "at_risk" | "overdue";
  totalProgress: number;
  daysElapsed: number;
  daysRemaining: number;
  inspectionStatus: StageStatus;
  reportStatus: StageStatus;
  alerts: SLAAlert[];
}

export interface StageStatus {
  targetHours: number;
  elapsedHours: number;
  isOverdue: boolean;
  completedAt: string | null;
}

export interface SLAAlert {
  severity: "warning" | "critical";
  messageAr: string;
  messageEn: string;
  stage: string;
}

const DEFAULT_SLA: SLAConfig = {
  inspectionHours: 48,
  reportHours: 120,
  totalDays: 10,
};

export function calculateSLA(
  assignment: {
    created_at: string;
    sla_total_days?: number | null;
    sla_inspection_hours?: number | null;
    sla_report_hours?: number | null;
    sla_status?: string | null;
    actual_inspection_completed_at?: string | null;
    actual_report_completed_at?: string | null;
    status: string;
  }
): SLAResult {
  const config: SLAConfig = {
    inspectionHours: assignment.sla_inspection_hours || DEFAULT_SLA.inspectionHours,
    reportHours: assignment.sla_report_hours || DEFAULT_SLA.reportHours,
    totalDays: assignment.sla_total_days || DEFAULT_SLA.totalDays,
  };

  const now = new Date();
  const created = new Date(assignment.created_at);
  const totalMs = config.totalDays * 24 * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - created.getTime();
  const daysElapsed = Math.ceil(elapsedMs / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, config.totalDays - daysElapsed);
  const totalProgress = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

  // Inspection stage
  const inspElapsedHours = assignment.actual_inspection_completed_at
    ? (new Date(assignment.actual_inspection_completed_at).getTime() - created.getTime()) / (1000 * 60 * 60)
    : elapsedMs / (1000 * 60 * 60);

  const inspectionStatus: StageStatus = {
    targetHours: config.inspectionHours,
    elapsedHours: Math.round(inspElapsedHours),
    isOverdue: !assignment.actual_inspection_completed_at && inspElapsedHours > config.inspectionHours,
    completedAt: assignment.actual_inspection_completed_at || null,
  };

  // Report stage
  const reportStart = assignment.actual_inspection_completed_at
    ? new Date(assignment.actual_inspection_completed_at)
    : created;
  const reportElapsedHours = assignment.actual_report_completed_at
    ? (new Date(assignment.actual_report_completed_at).getTime() - reportStart.getTime()) / (1000 * 60 * 60)
    : (now.getTime() - reportStart.getTime()) / (1000 * 60 * 60);

  const reportStatus: StageStatus = {
    targetHours: config.reportHours,
    elapsedHours: Math.round(reportElapsedHours),
    isOverdue: !assignment.actual_report_completed_at && assignment.actual_inspection_completed_at != null && reportElapsedHours > config.reportHours,
    completedAt: assignment.actual_report_completed_at || null,
  };

  // Alerts
  const alerts: SLAAlert[] = [];

  if (inspectionStatus.isOverdue) {
    alerts.push({
      severity: "critical",
      messageAr: `تأخر المعاينة: تجاوز ${config.inspectionHours} ساعة المحددة`,
      messageEn: `Inspection overdue: exceeded ${config.inspectionHours}h target`,
      stage: "inspection",
    });
  } else if (!inspectionStatus.completedAt && inspElapsedHours > config.inspectionHours * 0.75) {
    alerts.push({
      severity: "warning",
      messageAr: `تنبيه: اقتراب موعد تسليم المعاينة (${Math.round(config.inspectionHours - inspElapsedHours)} ساعة متبقية)`,
      messageEn: `Warning: inspection deadline approaching (${Math.round(config.inspectionHours - inspElapsedHours)}h remaining)`,
      stage: "inspection",
    });
  }

  if (reportStatus.isOverdue) {
    alerts.push({
      severity: "critical",
      messageAr: `تأخر التقرير: تجاوز ${config.reportHours} ساعة المحددة`,
      messageEn: `Report overdue: exceeded ${config.reportHours}h target`,
      stage: "report",
    });
  } else if (!reportStatus.completedAt && assignment.actual_inspection_completed_at && reportElapsedHours > config.reportHours * 0.75) {
    alerts.push({
      severity: "warning",
      messageAr: `تنبيه: اقتراب موعد تسليم التقرير (${Math.round(config.reportHours - reportElapsedHours)} ساعة متبقية)`,
      messageEn: `Warning: report deadline approaching (${Math.round(config.reportHours - reportElapsedHours)}h remaining)`,
      stage: "report",
    });
  }

  if (daysRemaining === 0 && assignment.status !== "closed" && assignment.status !== "report_issued") {
    alerts.push({
      severity: "critical",
      messageAr: "تجاوز المهمة للموعد النهائي الإجمالي",
      messageEn: "Assignment has exceeded total SLA deadline",
      stage: "total",
    });
  }

  // Overall status
  let status: SLAResult["status"] = "on_track";
  if (alerts.some(a => a.severity === "critical")) {
    status = "overdue";
  } else if (alerts.length > 0 || totalProgress > 80) {
    status = "at_risk";
  }

  return {
    status,
    totalProgress,
    daysElapsed,
    daysRemaining,
    inspectionStatus,
    reportStatus,
    alerts,
  };
}

export function getSLAStatusColor(status: SLAResult["status"]): string {
  switch (status) {
    case "on_track": return "text-success";
    case "at_risk": return "text-warning";
    case "overdue": return "text-destructive";
  }
}

export function getSLAStatusLabel(status: SLAResult["status"]): string {
  switch (status) {
    case "on_track": return "في الموعد";
    case "at_risk": return "تحذير";
    case "overdue": return "متأخر";
  }
}
