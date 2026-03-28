import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Calendar,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import StatCard from "@/components/dashboard/StatCard";
import RecentAssignments from "@/components/dashboard/RecentAssignments";
import QuickActions from "@/components/dashboard/QuickActions";
import ActivityTimeline from "@/components/dashboard/ActivityTimeline";

export default function Dashboard() {
  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="إجمالي التقييمات"
            value={142}
            subtitle="منذ بداية العام"
            icon={<FileText className="w-5 h-5" />}
            variant="primary"
            trend={{ value: "+12% عن الشهر السابق", positive: true }}
          />
          <StatCard
            title="قيد التنفيذ"
            value={18}
            subtitle="تقييم نشط"
            icon={<Clock className="w-5 h-5" />}
            variant="warning"
          />
          <StatCard
            title="مكتملة هذا الشهر"
            value={24}
            subtitle="تقرير معتمد"
            icon={<CheckCircle2 className="w-5 h-5" />}
            variant="accent"
            trend={{ value: "+8% عن الشهر السابق", positive: true }}
          />
          <StatCard
            title="تنبيهات الامتثال"
            value={3}
            subtitle="تحتاج مراجعة"
            icon={<AlertTriangle className="w-5 h-5" />}
            variant="default"
          />
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentAssignments />
          </div>
          <div>
            <ActivityTimeline />
          </div>
        </div>

        {/* Pipeline summary */}
        <div className="bg-card rounded-lg border border-border shadow-card p-5 animate-fade-in">
          <h3 className="font-semibold text-foreground mb-4">ملخص خط الإنتاج</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "طلبات جديدة", count: 5, color: "bg-primary" },
              { label: "جمع البيانات", count: 4, color: "bg-accent" },
              { label: "قيد التقييم", count: 6, color: "bg-warning" },
              { label: "قيد المراجعة", count: 3, color: "bg-info" },
              { label: "جاهزة للإصدار", count: 2, color: "bg-success" },
            ].map((stage) => (
              <div key={stage.label} className="text-center p-4 rounded-lg bg-muted/30 border border-border">
                <div className={`w-3 h-3 rounded-full ${stage.color} mx-auto mb-2`} />
                <div className="text-2xl font-bold text-foreground">{stage.count}</div>
                <div className="text-xs text-muted-foreground mt-1">{stage.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
