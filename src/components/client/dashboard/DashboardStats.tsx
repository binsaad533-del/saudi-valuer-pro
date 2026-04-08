import { Card, CardContent } from "@/components/ui/card";
import { FileText, Clock, AlertCircle, CheckCircle } from "lucide-react";

interface DashboardStatsProps {
  stats: {
    total: number;
    active: number;
    awaitingAction: number;
    completed: number;
  };
}

const STAT_ITEMS = [
  { key: "total", label: "إجمالي الطلبات", icon: FileText },
  { key: "active", label: "نشطة", icon: Clock },
  { key: "awaitingAction", label: "تحتاج إجراءك", icon: AlertCircle },
  { key: "completed", label: "مكتملة", icon: CheckCircle },
] as const;

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {STAT_ITEMS.map((s) => (
        <Card key={s.key}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <s.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats[s.key]}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
