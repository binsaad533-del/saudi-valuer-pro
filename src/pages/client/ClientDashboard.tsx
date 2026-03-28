import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  CreditCard,
  MessageSquare,
  Archive,
  LogOut,
  Loader2,
  Building2,
} from "lucide-react";
import logo from "@/assets/logo.png";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "مسودة", color: "bg-muted text-muted-foreground", icon: FileText },
  ai_review: { label: "مراجعة ذكية", color: "bg-info/10 text-info", icon: Clock },
  submitted: { label: "تم الإرسال", color: "bg-primary/10 text-primary", icon: CheckCircle },
  needs_clarification: { label: "يحتاج توضيح", color: "bg-warning/10 text-warning", icon: AlertCircle },
  under_pricing: { label: "قيد التسعير", color: "bg-accent text-accent-foreground", icon: CreditCard },
  quotation_sent: { label: "عرض سعر مرسل", color: "bg-info/10 text-info", icon: FileText },
  quotation_approved: { label: "عرض سعر معتمد", color: "bg-success/10 text-success", icon: CheckCircle },
  awaiting_payment: { label: "بانتظار الدفع", color: "bg-warning/10 text-warning", icon: CreditCard },
  payment_uploaded: { label: "إيصال مرفوع", color: "bg-info/10 text-info", icon: CreditCard },
  partially_paid: { label: "مدفوع جزئياً", color: "bg-warning/10 text-warning", icon: CreditCard },
  fully_paid: { label: "مدفوع بالكامل", color: "bg-success/10 text-success", icon: CheckCircle },
  in_production: { label: "قيد التنفيذ", color: "bg-primary/10 text-primary", icon: Building2 },
  draft_report_sent: { label: "تقرير مسودة", color: "bg-info/10 text-info", icon: FileText },
  client_comments: { label: "ملاحظات العميل", color: "bg-warning/10 text-warning", icon: MessageSquare },
  final_report_ready: { label: "التقرير النهائي جاهز", color: "bg-success/10 text-success", icon: CheckCircle },
  completed: { label: "مكتمل", color: "bg-success/10 text-success", icon: CheckCircle },
  archived: { label: "مؤرشف", color: "bg-muted text-muted-foreground", icon: Archive },
};

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/client/login");
        return;
      }

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name_ar")
        .eq("user_id", user.id)
        .maybeSingle();

      setUserName(profile?.full_name_ar || user.user_metadata?.full_name || "عميل");

      // Fetch requests
      const { data } = await supabase
        .from("valuation_requests")
        .select("*")
        .eq("client_user_id", user.id)
        .order("created_at", { ascending: false });

      setRequests(data || []);
      setLoading(false);
    };
    init();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/client/login");
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { label: status, color: "bg-muted text-muted-foreground", icon: FileText };
    return (
      <Badge variant="secondary" className={`${config.color} gap-1`}>
        <config.icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  // Stats
  const stats = {
    total: requests.length,
    active: requests.filter(r => !["completed", "archived", "cancelled"].includes(r.status)).length,
    awaitingAction: requests.filter(r => ["quotation_sent", "needs_clarification", "draft_report_sent"].includes(r.status)).length,
    completed: requests.filter(r => r.status === "completed").length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="جساس" className="w-9 h-9" />
            <div>
              <h2 className="text-sm font-bold text-foreground">بوابة العملاء</h2>
              <p className="text-xs text-muted-foreground">جساس للتقييم</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-foreground font-medium hidden sm:block">أهلاً، {userName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 ml-1" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Welcome & CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">مرحباً، {userName}</h1>
            <p className="text-sm text-muted-foreground">إدارة طلبات التقييم والتقارير</p>
          </div>
          <Button onClick={() => navigate("/client/new-request")} className="gap-2">
            <Plus className="w-4 h-4" />
            طلب تقييم جديد
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "إجمالي الطلبات", value: stats.total, icon: FileText, color: "text-primary" },
            { label: "طلبات نشطة", value: stats.active, icon: Clock, color: "text-info" },
            { label: "تحتاج إجراءك", value: stats.awaitingAction, icon: AlertCircle, color: "text-warning" },
            { label: "مكتملة", value: stats.completed, icon: CheckCircle, color: "text-success" },
          ].map((stat) => (
            <Card key={stat.label} className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <stat.icon className={`w-8 h-8 ${stat.color} opacity-60`} />
                  <div className="text-left">
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Requests List */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">طلبات التقييم</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-4">لا توجد طلبات تقييم بعد</p>
                <Button onClick={() => navigate("/client/new-request")} variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" />
                  ابدأ طلب تقييم جديد
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <Link
                    key={req.id}
                    to={`/client/request/${req.id}`}
                    className="block p-4 rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {req.property_description_ar || "طلب تقييم جديد"}
                          </span>
                          {req.reference_number && (
                            <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                              {req.reference_number}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {req.property_city_ar && <span>{req.property_city_ar}</span>}
                          <span>{new Date(req.created_at).toLocaleDateString("ar-SA")}</span>
                        </div>
                      </div>
                      {getStatusBadge(req.status)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
