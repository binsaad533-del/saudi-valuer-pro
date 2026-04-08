import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Zap, ChevronLeft } from "lucide-react";

interface ActionItem {
  id: string;
  clientName: string;
  status: string;
  reason: string;
  updatedAt: string;
}

interface Props {
  items: ActionItem[];
  onOpen: (id: string) => void;
}


function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "الآن";
  if (diffMin < 60) return `${diffMin} د`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} س`;
  return `${Math.floor(diffHr / 24)} ي`;
}

export default function ActionRequiredPanel({ items, onOpen }: Props) {
  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="rounded-xl border border-amber-200/60 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-950/10 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <Zap className="w-3 h-3 text-amber-600 dark:text-amber-400" />
        </div>
        <span className="text-xs font-bold text-foreground">إجراء مطلوب الآن</span>
        <Badge variant="outline" className="text-[10px] h-5 mr-auto">{items.length}</Badge>
      </div>

      <div className="space-y-1.5">
        {items.slice(0, 6).map((item, i) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.04 }}
            onClick={() => onOpen(item.id)}
            className="w-full flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-right hover:bg-muted/40 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground truncate">{item.clientName}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">منذ {formatRelativeTime(item.updatedAt)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{item.reason}</p>
            </div>
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </motion.button>
        ))}
        {items.length > 6 && (
          <p className="text-[10px] text-muted-foreground text-center pt-1">+{items.length - 6} إجراء آخر</p>
        )}
      </div>
    </motion.div>
  );
}
