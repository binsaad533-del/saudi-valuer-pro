import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  MapPin,
  DollarSign,
  BarChart3,
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
        {/* Stats Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            index={0}
            title="إجمالي التقييمات"
            value={142}
            subtitle="منذ بداية العام"
            icon={<FileText className="w-5 h-5" />}
            variant="primary"
            href="/valuations"
            trend={{ value: "+12% عن الشهر السابق", positive: true }}
            details={[
              { label: "عقار", value: 98 },
              { label: "آلات ومعدات", value: 44 },
            ]}
          />
          <StatCard
            index={1}
            title="قيد التنفيذ"
            value={18}
            subtitle="تقييم نشط"
            icon={<Clock className="w-5 h-5" />}
            variant="warning"
            href="/valuations?status=in_progress"
            details={[
              { label: "معاينة", value: 7 },
              { label: "تحليل", value: 6 },
              { label: "مراجعة", value: 5 },
            ]}
          />
          <StatCard
            title="مكتملة هذا الشهر"
            value={24}
            subtitle="تقرير معتمد"
            icon={<CheckCircle2 className="w-5 h-5" />}
            variant="accent"
            href="/valuations?status=completed"
            trend={{ value: "+8% عن الشهر السابق", positive: true }}
            details={[
              { label: "متوسط المدة", value: "4.2 يوم" },
              { label: "نسبة الجودة", value: "96%" },
            ]}
          />
          <StatCard
            title="تنبيهات الامتثال"
            value={3}
            subtitle="تحتاج مراجعة"
            icon={<AlertTriangle className="w-5 h-5" />}
            variant="default"
            href="/compliance"
            details={[
              { label: "عاجلة", value: 1 },
              { label: "متوسطة", value: 2 },
            ]}
          />
        </div>

        {/* Stats Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="العملاء النشطين"
            value={36}
            subtitle="عميل مسجّل"
            icon={<Users className="w-5 h-5" />}
            href="/clients-management"
            details={[
              { label: "أفراد", value: 22 },
              { label: "شركات", value: 14 },
            ]}
          />
          <StatCard
            title="المعاينات اليوم"
            value={5}
            subtitle="معاينة مجدولة"
            icon={<MapPin className="w-5 h-5" />}
            href="/inspectors"
            details={[
              { label: "مكتملة", value: 2 },
              { label: "متبقية", value: 3 },
            ]}
          />
          <StatCard
            title="الإيرادات الشهرية"
            value="385,000"
            subtitle="ريال سعودي"
            icon={<DollarSign className="w-5 h-5" />}
            href="/settings"
            trend={{ value: "+15% عن الشهر السابق", positive: true }}
            details={[
              { label: "محصّلة", value: "310,000" },
              { label: "معلّقة", value: "75,000" },
            ]}
          />
          <StatCard
            title="متوسط التقييم"
            value="4.8"
            subtitle="من 5.0"
            icon={<BarChart3 className="w-5 h-5" />}
            variant="accent"
            href="/review"
            details={[
              { label: "جودة التقارير", value: "4.9" },
              { label: "سرعة الإنجاز", value: "4.6" },
            ]}
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
