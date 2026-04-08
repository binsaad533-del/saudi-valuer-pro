import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PIPELINE_PHASES,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/workflow-engine";
import {
  Loader2, AlertTriangle, Clock, User, Building2,
  ChevronLeft, ChevronRight,
} from "lucide-react";

interface Assignment {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  client_name_ar?: string;
  property_type?: string;
  valuation_type?: string;
  reference_number?: string;
}

const PHASE_COLORS: Record<string, string> = {
  intake: "border-t-primary/60",
  processing: "border-t-accent-foreground/40",
  inspection: "border-t-warning/60",
  validation: "border-t-primary/40",
  valuation: "border-t-warning/80",
  review: "border-t-success/60",
  finalization: "border-t-success/80",
};

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function AssignmentCard({ a, onClick }: { a: Assignment; onClick: () => void }) {
  const days = daysAgo(a.updated_at);
  const isStale = days > 3;

  return (
    <Card
      onClick={onClick}
      className="p-3 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 border border-border/60 bg-card"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono text-muted-foreground">
          {a.reference_number || a.id.slice(0, 8)}
        </span>
        {isStale && (
          <Tooltip>
            <TooltipTrigger>
              <AlertTriangle className="w-3.5 h-3.5 text-warning" />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">متوقف منذ {days} يوم</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {a.client_name_ar && (
        <div className="flex items-center gap-1.5 mb-1">
          <User className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground truncate">{a.client_name_ar}</span>
        </div>
      )}

      {a.property_type && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground truncate">{a.property_type}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Badge
          variant="outline"
          className={`text-[9px] px-1.5 py-0 h-4 ${STATUS_COLORS[a.status] || "bg-muted text-muted-foreground"}`}
        >
          {STATUS_LABELS[a.status]?.ar || a.status}
        </Badge>
        <div className="flex items-center gap-0.5 text-muted-foreground/60">
          <Clock className="w-3 h-3" />
          <span className="text-[9px]">{days}ي</span>
        </div>
      </div>
    </Card>
  );
}

export default function KanbanBoard() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = useCallback(async () => {
    const { data } = await supabase
      .from("valuation_assignments")
      .select("id, status, created_at, updated_at, reference_number, property_type, valuation_type")
      .not("status", "in", "(archived,cancelled)")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (data) {
      // Enrich with client names if available
      setAssignments(data as Assignment[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssignments();

    // Realtime subscription
    const channel = supabase
      .channel("kanban-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "valuation_assignments" },
        () => fetchAssignments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAssignments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalActive = assignments.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-foreground">لوحة سير العمل</h2>
          <Badge variant="secondary" className="text-xs">{totalActive} طلب نشط</Badge>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground/50">
          <ChevronRight className="w-4 h-4" />
          <span className="text-[10px]">اسحب للتصفح</span>
          <ChevronLeft className="w-4 h-4" />
        </div>
      </div>

      {/* Kanban columns */}
      <ScrollArea className="w-full" dir="rtl">
        <div className="flex gap-3 pb-4" style={{ minWidth: "max-content" }}>
          {PIPELINE_PHASES.filter(p => p.key !== "finalization").map((phase) => {
            const phaseAssignments = assignments.filter((a) =>
              phase.statuses.includes(a.status)
            );
            const hasStale = phaseAssignments.some((a) => daysAgo(a.updated_at) > 3);

            return (
              <div
                key={phase.key}
                className={`w-[220px] shrink-0 rounded-xl bg-muted/30 border border-border/40 border-t-4 ${PHASE_COLORS[phase.key] || "border-t-muted"}`}
              >
                {/* Column header */}
                <div className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{phase.label}</span>
                    <Badge
                      variant={phaseAssignments.length > 0 ? "default" : "outline"}
                      className="text-[10px] px-1.5 py-0 h-5 min-w-5 flex items-center justify-center"
                    >
                      {phaseAssignments.length}
                    </Badge>
                  </div>
                  {hasStale && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 text-warning" />
                      <span className="text-[9px] text-warning">تراكم</span>
                    </div>
                  )}
                </div>

                {/* Cards */}
                <div className="px-2 pb-2 space-y-2 max-h-[400px] overflow-y-auto">
                  {phaseAssignments.length === 0 ? (
                    <div className="py-6 text-center text-muted-foreground/40">
                      <span className="text-xs">—</span>
                    </div>
                  ) : (
                    phaseAssignments.map((a) => (
                      <AssignmentCard
                        key={a.id}
                        a={a}
                        onClick={() => navigate(`/assignment/${a.id}`)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
