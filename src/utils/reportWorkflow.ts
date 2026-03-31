import { Report, ReportStatus, WorkflowAction } from "@/types/report";

const IMMUTABLE_STATUSES: ReportStatus[] = ["issued", "delivered"];

export function isReportLocked(status: ReportStatus): boolean {
  return IMMUTABLE_STATUSES.includes(status);
}

const VALID_TRANSITIONS: Record<ReportStatus, WorkflowAction[]> = {
  draft: ["submit_review", "cancel"],
  review: ["approve", "reject", "cancel"],
  approved: ["issue", "cancel"],
  issued: ["deliver"],
  delivered: [],
  cancelled: [],
};

const OWNER_ONLY_ACTIONS: WorkflowAction[] = ["approve", "issue"];

export function getAvailableActions(status: ReportStatus, isOwner: boolean): WorkflowAction[] {
  const actions = VALID_TRANSITIONS[status] || [];
  if (!isOwner) {
    return actions.filter((a) => !OWNER_ONLY_ACTIONS.includes(a));
  }
  return actions;
}

export function canPerformAction(status: ReportStatus, action: WorkflowAction, isOwner: boolean): boolean {
  return getAvailableActions(status, isOwner).includes(action);
}

function getNextStatus(action: WorkflowAction): ReportStatus {
  const map: Record<WorkflowAction, ReportStatus> = {
    create_draft: "draft",
    submit_review: "review",
    approve: "approved",
    reject: "draft",
    issue: "issued",
    deliver: "delivered",
    cancel: "cancelled",
  };
  return map[action];
}

export function executeWorkflowAction(
  report: Report,
  action: WorkflowAction,
  performedBy: string,
  isOwner: boolean,
  details?: string
): Report {
  if (!canPerformAction(report.status, action, isOwner)) {
    throw new Error(`لا يمكن تنفيذ "${action}" على تقرير بحالة "${report.status}"`);
  }

  const now = new Date().toISOString();
  const newStatus = getNextStatus(action);

  const updatedReport: Report = {
    ...report,
    status: newStatus,
    updatedAt: now,
    auditLog: [
      ...report.auditLog,
      {
        action,
        performedBy,
        timestamp: now,
        details: details || getDefaultDetails(action),
      },
    ],
  };

  if (action === "approve") updatedReport.approvedAt = now;
  if (action === "issue") updatedReport.issuedAt = now;
  if (action === "deliver") updatedReport.deliveredAt = now;

  return updatedReport;
}

function getDefaultDetails(action: WorkflowAction): string {
  const map: Record<WorkflowAction, string> = {
    create_draft: "إنشاء مسودة التقرير",
    submit_review: "إرسال التقرير للمراجعة",
    approve: "اعتماد التقرير",
    reject: "إعادة التقرير للتعديل",
    issue: "إصدار التقرير النهائي",
    deliver: "تسليم التقرير للعميل",
    cancel: "إلغاء التقرير",
  };
  return map[action];
}

export function getStatusLabel(status: ReportStatus): string {
  const map: Record<ReportStatus, string> = {
    draft: "مسودة",
    review: "قيد المراجعة",
    approved: "معتمد",
    issued: "صادر",
    delivered: "مُسلَّم",
    cancelled: "ملغي",
  };
  return map[status];
}

export function getStatusColor(status: ReportStatus): string {
  const map: Record<ReportStatus, string> = {
    draft: "bg-muted text-muted-foreground",
    review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    issued: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    delivered: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    cancelled: "bg-destructive/10 text-destructive",
  };
  return map[status];
}
