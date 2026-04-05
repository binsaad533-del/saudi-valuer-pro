import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Brain,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileSearch,
  Layers,
  ShieldCheck,
  Package,
  XCircle,
  RefreshCw,
} from "lucide-react";

interface ProcessingJob {
  id: string;
  status: string;
  total_files: number;
  processed_files: number;
  total_assets_found: number;
  duplicates_found: number;
  low_confidence_count: number;
  missing_fields_count: number;
  current_message: string;
  error_message: string | null;
  discipline: string;
  description: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface Props {
  jobId: string | null;
  onReady: (jobId: string) => void;
  onCancel: () => void;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string; pct: number }> = {
  pending: { icon: Loader2, color: "text-muted-foreground", label: "قيد الانتظار", pct: 5 },
  uploading: { icon: Loader2, color: "text-primary", label: "جارٍ الرفع", pct: 10 },
  classifying: { icon: FileSearch, color: "text-primary", label: "تصنيف المستندات", pct: 25 },
  extracting: { icon: Brain, color: "text-primary", label: "استخراج الأصول", pct: 50 },
  deduplicating: { icon: Layers, color: "text-amber-500", label: "كشف التكرارات", pct: 75 },
  merging: { icon: Package, color: "text-primary", label: "بناء السجل النهائي", pct: 90 },
  ready: { icon: CheckCircle, color: "text-success", label: "جاهز للمراجعة", pct: 100 },
  failed: { icon: XCircle, color: "text-destructive", label: "فشل في المعالجة", pct: 0 },
  cancelled: { icon: XCircle, color: "text-muted-foreground", label: "تم الإلغاء", pct: 0 },
};

export default function ProcessingStatusTracker({ jobId, onReady, onCancel }: Props) {
  const [job, setJob] = useState<ProcessingJob | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!jobId) return;
    const { data } = await supabase
      .from("processing_jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    if (data) {
      setJob(data as any);
      if ((data as any).status === "ready") {
        onReady(jobId);
      }
    }
  }, [jobId, onReady]);

  // Realtime subscription
  useEffect(() => {
    if (!jobId) return;
    fetchStatus();

    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "processing_jobs", filter: `id=eq.${jobId}` },
        (payload) => {
          const updated = payload.new as any;
          setJob(updated);
          if (updated.status === "ready") {
            onReady(jobId);
          }
        }
      )
      .subscribe();

    // Fallback polling every 3s
    const interval = setInterval(fetchStatus, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [jobId, fetchStatus, onReady]);

  if (!job) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-sm text-muted-foreground">جارٍ تحميل حالة المعالجة...</p>
        </CardContent>
      </Card>
    );
  }

  const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const StatusIcon = config.icon;
  const isActive = ["pending", "uploading", "classifying", "extracting", "deduplicating", "merging"].includes(job.status);
  const progress = isActive
    ? Math.max(config.pct, job.total_files > 0 ? Math.round((job.processed_files / job.total_files) * 100) : config.pct)
    : config.pct;

  const elapsed = job.started_at
    ? Math.round((Date.now() - new Date(job.started_at).getTime()) / 1000)
    : 0;
  const elapsedStr = elapsed > 60
    ? `${Math.floor(elapsed / 60)} دقيقة ${elapsed % 60} ثانية`
    : `${elapsed} ثانية`;

  return (
    <Card className="shadow-card">
      <CardContent className="p-8">
        {/* Status Icon */}
        <div className="text-center mb-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isActive ? "gradient-primary animate-pulse" : job.status === "ready" ? "bg-success/10" : "bg-destructive/10"
          }`}>
            <StatusIcon className={`w-10 h-10 ${
              isActive ? "text-primary-foreground animate-spin" : config.color
            }`} />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">{config.label}</h3>
          <p className="text-sm text-muted-foreground">{job.current_message}</p>
        </div>

        {/* Progress Bar */}
        {isActive && (
          <div className="mb-6">
            <Progress value={progress} className="mb-2 h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{job.processed_files} / {job.total_files} ملف</span>
              <span>{elapsedStr}</span>
            </div>
          </div>
        )}

        {/* Processing Steps */}
        <div className="space-y-2 mb-6">
          {Object.entries(STATUS_CONFIG).filter(([k]) => !["cancelled"].includes(k)).map(([key, cfg]) => {
            const stepIndex = Object.keys(STATUS_CONFIG).indexOf(key);
            const currentIndex = Object.keys(STATUS_CONFIG).indexOf(job.status);
            const isDone = stepIndex < currentIndex && job.status !== "failed";
            const isCurrent = key === job.status;
            if (key === "failed" && job.status !== "failed") return null;

            return (
              <div key={key} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                isCurrent ? "bg-primary/5 border border-primary/20" :
                isDone ? "opacity-60" : "opacity-30"
              }`}>
                {isDone ? (
                  <CheckCircle className="w-4 h-4 text-success shrink-0" />
                ) : isCurrent ? (
                  <cfg.icon className={`w-4 h-4 ${cfg.color} shrink-0 ${isActive ? "animate-spin" : ""}`} />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                )}
                <span className={`text-sm ${isCurrent ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                  {cfg.label}
                </span>
                {isDone && <CheckCircle className="w-3 h-3 text-success mr-auto" />}
              </div>
            );
          })}
        </div>

        {/* Stats (when available) */}
        {(job.total_assets_found > 0 || job.status === "ready") && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-xl font-bold text-foreground">{job.total_assets_found}</p>
              <p className="text-[10px] text-muted-foreground">أصل مكتشف</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-xl font-bold text-amber-500">{job.duplicates_found}</p>
              <p className="text-[10px] text-muted-foreground">تكرار مكتشف</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-xl font-bold text-orange-500">{job.low_confidence_count}</p>
              <p className="text-[10px] text-muted-foreground">ثقة منخفضة</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-xl font-bold text-destructive">{job.missing_fields_count}</p>
              <p className="text-[10px] text-muted-foreground">حقول ناقصة</p>
            </div>
          </div>
        )}

        {/* Error */}
        {job.status === "failed" && job.error_message && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
            <p className="text-sm text-destructive">{job.error_message}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-center">
          {isActive && (
            <p className="text-xs text-muted-foreground text-center">
              يمكنك مغادرة الصفحة والعودة لاحقاً — لن يتوقف التحليل
            </p>
          )}
          {job.status === "failed" && (
            <Button variant="outline" size="sm" onClick={onCancel} className="gap-1">
              <RefreshCw className="w-3 h-3" />
              إعادة المحاولة
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
