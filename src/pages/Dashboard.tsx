import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import StatCard from "@/components/dashboard/StatCard";
import RecentAssignments from "@/components/dashboard/RecentAssignments";
import QuickActions from "@/components/dashboard/QuickActions";
import ActivityTimeline from "@/components/dashboard/ActivityTimeline";
import WorkflowPipeline from "@/components/dashboard/WorkflowPipeline";

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

        {/* Workflow Pipeline */}
        <WorkflowPipeline />

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentAssignments />
          </div>
          <div>
            <ActivityTimeline />
          </div>
        </div>
      </div>
    </div>
  );
}
