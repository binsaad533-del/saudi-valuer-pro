import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, ShieldCheck, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RebuildJob {
  id: string;
  status: string;
  total_documents: number;
  processed_documents: number;
  total_rules_extracted: number;
  total_rules_inserted: number;
  duplicates_removed: number;
  critical_rules: number;
  warning_rules: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export default function KnowledgeRebuildPanel() {
  const [job, setJob] = useState<RebuildJob | null>(null);
  const [starting, setStarting] = useState(false);

  const fetchLatestJob = useCallback(async () => {
    const { data } = await supabase
      .from("knowledge_rebuild_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (data) setJob(data as RebuildJob);
  }, []);

  useEffect(() => {
    fetchLatestJob();
  }, [fetchLatestJob]);

  // Realtime subscription for progress
  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;

    const channel = supabase
      .channel("rebuild-progress")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "knowledge_rebuild_jobs",
        filter: `id=eq.${job.id}`,
      }, (payload) => {
        setJob(payload.new as RebuildJob);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [job?.id, job?.status]);

  const startRebuild = async () => {
    setStarting(true);
    try {
      // Create job record
      const { data: newJob, error: insertErr } = await supabase
        .from("knowledge_rebuild_jobs")
        .insert({ status: "pending", created_by: "user" })
        .select()
        .single();

      if (insertErr || !newJob) throw new Error("فشل إنشاء المهمة");

      setJob(newJob as RebuildJob);

      // Fire and forget — the edge function runs in the background
      supabase.functions.invoke("rebuild-knowledge", {
        body: { job_id: newJob.id },
      }).catch((err) => {
        console.error("Rebuild invocation error:", err);
      });

      toast.success("بدأت عملية إعادة بناء القواعد");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setStarting(false);
    }
  };

  const isRunning = job?.status === "running" || job?.status === "pending";
  const progress = job && job.total_documents > 0
    ? Math.round((job.processed_documents / job.total_documents) * 100)
    : 0;

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          إعادة بناء القواعد الشاملة
        </h3>
        <Button
          onClick={startRebuild}
          disabled={isRunning || starting}
          size="sm"
          className="gap-1.5 text-xs"
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {isRunning ? "جارٍ المعالجة..." : "بدء إعادة البناء"}
        </Button>
      </div>

      {isRunning && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>معالجة المستندات: {job!.processed_documents}/{job!.total_documents}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-[10px] text-muted-foreground">
            قواعد مستخرجة حتى الآن: {job!.total_rules_extracted}
          </p>
        </div>
      )}

      {job?.status === "completed" && (
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            label="إجمالي القواعد"
            value={job.total_rules_inserted}
          />
          <StatBox
            icon={<ShieldCheck className="w-4 h-4 text-red-500" />}
            label="قواعد حرجة"
            value={job.critical_rules}
          />
          <StatBox
            icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
            label="قواعد تحذيرية"
            value={job.warning_rules}
          />
          <StatBox
            icon={<Clock className="w-4 h-4 text-muted-foreground" />}
            label="تكرارات محذوفة"
            value={job.duplicates_removed}
          />
        </div>
      )}

      {job?.status === "completed" && job.completed_at && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          آخر تحديث: {new Date(job.completed_at).toLocaleString("ar-SA")}
        </p>
      )}

      {job?.status === "failed" && (
        <div className="bg-destructive/10 rounded-lg p-3">
          <p className="text-xs text-destructive font-medium">فشلت العملية</p>
          <p className="text-[10px] text-destructive/80 mt-1">{job.error_message}</p>
        </div>
      )}
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-muted/50 rounded-lg p-2.5 flex items-center gap-2">
      {icon}
      <div>
        <p className="text-lg font-bold text-foreground leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}
