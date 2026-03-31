import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus, FileText, Clock, CheckCircle, AlertCircle, LogOut,
  Loader2, Building2, Upload, Download, Eye, FolderOpen,
} from "lucide-react";
import { StatusBadge } from "@/components/workflow/StatusComponents";
import { toast } from "sonner";

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [activeTab, setActiveTab] = useState<"requests" | "reports" | "documents">("requests");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/client/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name_ar")
        .eq("user_id", user.id)
        .maybeSingle();

      setUserName(profile?.full_name_ar || user.user_metadata?.full_name || "عميل");

      const { data } = await supabase
        .from("valuation_requests" as any)
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
    window.location.replace("/client/login");
  };

  const handleFileUpload = () => {
    toast.success("تم رفع المستند بنجاح (تجريبي)");
  };

  const stats = {
    total: requests.length,
    active: requests.filter(r => !["completed", "archived", "cancelled"].includes(r.status)).length,
    awaitingAction: requests.filter(r => ["quotation_sent", "needs_clarification", "draft_report_sent"].includes(r.status)).length,
    completed: requests.filter(r => r.status === "completed").length,
  };

  // Mock ready reports
  const readyReports = requests
    .filter(r => r.status === "completed")
    .map((r, i) => ({
      id: r.id,
      title: r.property_description_ar || `تقرير تقييم #${i + 1}`,
      date: new Date(r.updated_at || r.created_at).toLocaleDateString("ar-SA"),
      ref: r.reference_number || `RPT-${String(i + 1).padStart(4, "0")}`,
    }));

  // Mock uploaded docs
  const mockDocs = [
    { id: "1", name: "صك الملكية.pdf", date: "2026-03-20", size: "2.4 MB" },
    { id: "2", name: "رخصة البناء.pdf", date: "2026-03-18", size: "1.1 MB" },
    { id: "3", name: "مخطط الموقع.jpg", date: "2026-03-15", size: "3.8 MB" },
  ];

  const TABS = [
    { key: "requests" as const, label: "طلباتي", icon: FileText, count: stats.total },
    { key: "reports" as const, label: "التقارير الجاهزة", icon: CheckCircle, count: stats.completed },
    { key: "documents" as const, label: "المستندات", icon: FolderOpen, count: mockDocs.length },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground">بوابة العملاء</h2>
            <p className="text-xs text-muted-foreground">جساس للتقييم</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-foreground font-medium hidden sm:block">أهلاً، {userName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 ml-1" /> خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Welcome */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">مرحباً، {userName}</h1>
            <p className="text-sm text-muted-foreground">تابع طلباتك وتقاريرك من مكان واحد</p>
          </div>
          <Button onClick={() => navigate("/client/new-request")} className="gap-2">
            <Plus className="w-4 h-4" /> طلب تقييم جديد
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "إجمالي الطلبات", value: stats.total, icon: FileText },
            { label: "نشطة", value: stats.active, icon: Clock },
            { label: "تحتاج إجراءك", value: stats.awaitingAction, icon: AlertCircle },
            { label: "مكتملة", value: stats.completed, icon: CheckCircle },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">{tab.count}</Badge>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "requests" && (
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-16">
                  <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm mb-4">لا توجد طلبات تقييم بعد</p>
                  <Button onClick={() => navigate("/client/new-request")} className="gap-2">
                    <Plus className="w-4 h-4" /> ابدأ طلب تقييم جديد
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {requests.map((req) => (
                    <Link
                      key={req.id}
                      to={`/client/request/${req.id}`}
                      className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {req.property_description_ar || "طلب تقييم"}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {req.reference_number && (
                            <span className="font-mono" dir="ltr">{req.reference_number}</span>
                          )}
                          {req.property_city_ar && <span>{req.property_city_ar}</span>}
                          <span>{new Date(req.created_at).toLocaleDateString("ar-SA")}</span>
                        </div>
                      </div>
                      <StatusBadge status={req.status} role="client" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "reports" && (
          <Card>
            <CardContent className="p-0">
              {readyReports.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">لا توجد تقارير جاهزة حالياً</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {readyReports.map((rpt) => (
                    <div key={rpt.id} className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground truncate">{rpt.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {rpt.ref} · {rpt.date}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "documents" && (
          <div className="space-y-4">
            {/* Upload area */}
            <Card
              className="border-dashed border-2 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center justify-center py-10 gap-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">اضغط لرفع مستند جديد</p>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG — حتى 20 ميجا</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </CardContent>
            </Card>

            {/* Docs list */}
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {mockDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.date} · {doc.size}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
