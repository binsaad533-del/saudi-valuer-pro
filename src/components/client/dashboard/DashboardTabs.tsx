import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, FolderOpen } from "lucide-react";

export type TabKey = "requests" | "reports" | "documents";

interface DashboardTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  counts: { requests: number; reports: number; documents: number };
}

const TABS = [
  { key: "requests" as const, label: "طلباتي", icon: FileText },
  { key: "reports" as const, label: "التقارير الجاهزة", icon: CheckCircle },
  { key: "documents" as const, label: "المستندات", icon: FolderOpen },
];

export function DashboardTabs({ activeTab, onTabChange, counts }: DashboardTabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === tab.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <tab.icon className="w-4 h-4" />
          {tab.label}
          {counts[tab.key] > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">{counts[tab.key]}</Badge>
          )}
        </button>
      ))}
    </div>
  );
}
