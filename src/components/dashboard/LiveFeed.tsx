import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

interface FeedEntry {
  id: string;
  action: string;
  description: string | null;
  created_at: string;
  table_name: string;
}

const actionTags: Record<string, { label: string; color: string }> = {
  status_change: { label: "تحديث", color: "bg-primary/10 text-primary" },
  create: { label: "جديد", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  insert: { label: "جديد", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  update: { label: "تعديل", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  delete: { label: "حذف", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  login: { label: "دخول", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "الآن";
  if (diffMin < 60) return `${diffMin} د`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} س`;
  return `${Math.floor(diffHr / 24)} ي`;
}

export default function LiveFeed() {
  const [entries, setEntries] = useState<FeedEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, description, created_at, table_name")
        .order("created_at", { ascending: false })
        .limit(8);
      setEntries((data as FeedEntry[]) || []);
    };
    load();
  }, []);

  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-bold text-foreground">الحركة الحية</span>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-auto" />
      </div>

      <div className="space-y-2">
        {entries.map((entry, i) => {
          const tag = actionTags[entry.action] || { label: entry.action, color: "bg-muted text-muted-foreground" };
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.03 }}
              className="flex items-center gap-2 py-1"
            >
              <Badge className={`${tag.color} border-0 text-[9px] px-1.5 py-0 h-4 shrink-0`}>{tag.label}</Badge>
              <span className="text-[11px] text-foreground truncate flex-1">
                {entry.description || `${entry.action} — ${entry.table_name}`}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{formatTime(entry.created_at)}</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
