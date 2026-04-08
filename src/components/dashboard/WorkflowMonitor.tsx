import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface PipelineStage {
  label: string;
  count: number;
  isBottleneck: boolean;
}

interface Props {
  stages: PipelineStage[];
  total: number;
}

export default function WorkflowMonitor({ stages, total }: Props) {
  if (total === 0) return null;

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.35 }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-foreground">مسار العمل</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{total} ملف نشط</span>
      </div>

      <div className="space-y-2">
        {stages.map((stage, i) => {
          const pct = Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 8 : 0);
          return (
            <motion.div
              key={stage.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.04 }}
              className="flex items-center gap-2"
            >
              <span className="text-[10px] text-muted-foreground w-20 shrink-0 truncate text-right">{stage.label}</span>
              <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, delay: 0.5 + i * 0.05 }}
                  className={`h-full rounded-full ${
                    stage.isBottleneck ? "bg-red-400 dark:bg-red-500" : "bg-primary/60"
                  }`}
                />
              </div>
              <div className="flex items-center gap-1 w-8 justify-end">
                {stage.isBottleneck && <AlertTriangle className="w-2.5 h-2.5 text-red-500" />}
                <span className={`text-[10px] font-medium tabular-nums ${stage.isBottleneck ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                  {stage.count}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
