import FinancialSummaryCards from "@/components/cfo/FinancialSummaryCards";
import RevenueChart from "@/components/cfo/RevenueChart";
import InvoicesTable from "@/components/cfo/InvoicesTable";
import CollectionStatus from "@/components/cfo/CollectionStatus";
import PaymentsLog from "@/components/cfo/PaymentsLog";
import KPIMetrics from "@/components/cfo/KPIMetrics";

export default function CFODashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة المدير المالي</h1>
        <p className="text-sm text-muted-foreground mt-1">مرحباً أحمد الشاذلي — عرض للقراءة فقط</p>
      </div>

      <FinancialSummaryCards />
      <RevenueChart />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CollectionStatus />
        <KPIMetrics />
      </div>
      <InvoicesTable />
      <PaymentsLog />
    </div>
  );
}
