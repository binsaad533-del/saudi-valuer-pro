import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import FinancialSummaryCards from "@/components/cfo/FinancialSummaryCards";
import RevenueChart from "@/components/cfo/RevenueChart";
import InvoicesTable from "@/components/cfo/InvoicesTable";
import CollectionStatus from "@/components/cfo/CollectionStatus";
import PaymentsLog from "@/components/cfo/PaymentsLog";
import KPIMetrics from "@/components/cfo/KPIMetrics";
import PaymentReceiptReview from "@/components/cfo/PaymentReceiptReview";

export default function CFODashboardPage() {
  const [userName, setUserName] = useState("المدير المالي");

  useEffect(() => {
    const fetchName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("full_name_ar").eq("user_id", user.id).single();
        if (data?.full_name_ar) setUserName(data.full_name_ar);
      }
    };
    fetchName();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة المدير المالي</h1>
        <p className="text-sm text-muted-foreground mt-1">مرحباً {userName} — عرض للقراءة فقط</p>
      </div>

      <FinancialSummaryCards />
      <PaymentReceiptReview />
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
