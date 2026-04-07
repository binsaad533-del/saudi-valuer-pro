import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  WORKFLOW_STATUSES,
  getStatusLabelForRole,
  getActionableStatusesForRole,
  PIPELINE_PHASES,
  normalizeStatus,
} from "@/lib/workflow-engine";
import { User, Building2, HardHat, DollarSign } from "lucide-react";

type Role = "client" | "owner" | "inspector" | "financial_manager";

interface RoleStatusViewProps {
  currentStatus: string;
  role: Role;
}

const ROLE_CONFIG: Record<Role, { label: string; icon: React.ReactNode }> = {
  client: { label: "العميل", icon: <User className="w-4 h-4" /> },
  owner: { label: "الإدارة / المقيّم", icon: <Building2 className="w-4 h-4" /> },
  inspector: { label: "المعاين", icon: <HardHat className="w-4 h-4" /> },
  financial_manager: { label: "المحاسبة", icon: <DollarSign className="w-4 h-4" /> },
};

export function RoleStatusView({ currentStatus, role }: RoleStatusViewProps) {
  const normalized = normalizeStatus(currentStatus);
  const config = ROLE_CONFIG[role];
  const roleLabel = getStatusLabelForRole(normalized, role);
  const actionable = getActionableStatusesForRole(role);
  const isActionNeeded = actionable.includes(normalized);
  const colorClass = STATUS_COLORS[normalized] || "bg-muted text-muted-foreground";

  // Inspector: show only if relevant
  if (role === "inspector" && !["inspection_pending", "inspection_completed"].includes(normalized)) {
    return (
      <Card className="opacity-60">
        <CardContent className="py-3 flex items-center gap-2 text-sm text-muted-foreground">
          {config.icon}
          <span>{config.label}: لا مهام حالياً</span>
        </CardContent>
      </Card>
    );
  }

  // Progress
  const currentIdx = WORKFLOW_STATUSES.indexOf(normalized as any);
  const pct = Math.round(((currentIdx + 1) / WORKFLOW_STATUSES.length) * 100);

  // Current phase
  const currentPhase = PIPELINE_PHASES.find((p) => p.statuses.includes(normalized));

  return (
    <Card className={isActionNeeded ? "ring-2 ring-primary/30" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            {config.icon}
            {config.label}
          </span>
          <Badge className={colorClass}>
            {STATUS_LABELS[normalized]?.icon} {roleLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{currentPhase?.label}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Action needed indicator */}
        {isActionNeeded && (
          <div className="p-2 rounded-md bg-primary/5 border border-primary/20">
            <p className="text-xs font-medium text-primary">⚡ إجراء مطلوب منك</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MultiRoleStatusViewProps {
  currentStatus: string;
}

export function MultiRoleStatusView({ currentStatus }: MultiRoleStatusViewProps) {
  const roles: Role[] = ["owner", "client", "inspector", "financial_manager"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {roles.map((role) => (
        <RoleStatusView key={role} currentStatus={currentStatus} role={role} />
      ))}
    </div>
  );
}
