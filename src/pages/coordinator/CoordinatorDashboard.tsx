import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardList, Users, AlertTriangle, CheckCircle2, Clock, FileText, TrendingUp,
  Loader2,
} from "lucide-react";
import CoordinatorStatCards from "@/components/coordinator/CoordinatorStatCards";
import CoordinatorRequestsTable from "@/components/coordinator/CoordinatorRequestsTable";
import CoordinatorNewRequest from "@/components/coordinator/CoordinatorNewRequest";
import CoordinatorActivityLog from "@/components/coordinator/CoordinatorActivityLog";
import CoordinatorClientCorrections from "@/components/coordinator/CoordinatorClientCorrections";
import CoordinatorAlerts from "@/components/coordinator/CoordinatorAlerts";

export default function CoordinatorDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [reqRes, clientRes] = await Promise.all([
      supabase.from("valuation_requests" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
    ]);
    setRequests((reqRes.data as any[]) || []);
    setClients(clientRes.data || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* Welcome Bar */}
      <Card className="shadow-card border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-foreground">
              واجهة المنسق الإداري — مرحباً عوب 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">إدارة الطلبات ومتابعة الإجراءات وتصحيح البيانات</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-muted-foreground">نشطة:</span>
              <span className="font-bold text-foreground">
                {requests.filter(r => !["completed", "closed", "report_issued"].includes(r.status)).length}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-muted-foreground">اليوم:</span>
              <span className="font-bold text-foreground">
                {requests.filter(r => new Date(r.created_at).toDateString() === new Date().toDateString()).length}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-muted-foreground">تحتاج تصحيح:</span>
              <span className="font-bold text-foreground">
                {requests.filter(r => ["awaiting_client_info", "client_comments"].includes(r.status)).length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <CoordinatorAlerts requests={requests} />

      {/* Stat Cards */}
      <CoordinatorStatCards requests={requests} clients={clients} />

      {/* Main Content Tabs */}
      <Tabs defaultValue="requests" dir="rtl">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="requests" className="text-xs py-2.5 gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" />
            الطلبات
          </TabsTrigger>
          <TabsTrigger value="new-request" className="text-xs py-2.5 gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            طلب جديد
          </TabsTrigger>
          <TabsTrigger value="corrections" className="text-xs py-2.5 gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            تصحيح الأخطاء
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs py-2.5 gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            سجل الإجراءات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <CoordinatorRequestsTable requests={requests} clients={clients} onRefresh={loadData} />
        </TabsContent>

        <TabsContent value="new-request" className="mt-4">
          <CoordinatorNewRequest clients={clients} onCreated={loadData} />
        </TabsContent>

        <TabsContent value="corrections" className="mt-4">
          <CoordinatorClientCorrections requests={requests} onRefresh={loadData} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <CoordinatorActivityLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
