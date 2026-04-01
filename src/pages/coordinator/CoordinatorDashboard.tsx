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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">واجهة المنسق الإداري</h1>
          <p className="text-sm text-muted-foreground">إدارة الطلبات ومتابعة الإجراءات</p>
        </div>
        <Badge variant="outline" className="text-xs">
          <Clock className="w-3 h-3 ml-1" />
          آخر تحديث: {new Date().toLocaleTimeString("ar-SA")}
        </Badge>
      </div>

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
          <CoordinatorRequestsTable requests={requests} onRefresh={loadData} />
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
