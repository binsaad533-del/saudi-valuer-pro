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
  Phone, Mail, MessageCircle, FileCheck, Search, BarChart3, ClipboardCheck, Settings,
} from "lucide-react";
import { EnhancedRequestTracker } from "@/components/client/EnhancedRequestTracker";
import ClientNotificationsBell from "@/components/client/ClientNotificationsBell";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import AppFooter from "@/components/layout/AppFooter";


export default function ClientDashboard() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [activeTab, setActiveTab] = useState<"requests" | "reports" | "documents">("requests");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [realDocs, setRealDocs] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUserId(user.id);

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

      // Load real documents
      const { data: docsData } = await supabase
        .from("request_documents" as any)
        .select("id, file_name, file_path, created_at, file_size, request_id")
        .eq("uploaded_by", user.id)
        .order("created_at", { ascending: false });
      setRealDocs((docsData as any[]) || []);

      setLoading(false);
    };
    init();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.replace("/login");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("client-uploads").upload(path, file);
      if (error) throw error;
      await supabase.from("request_documents" as any).insert({
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        uploaded_by: user.id,
      });
      toast.success("تم رفع المستند بنجاح");
      // Refresh docs
      const { data: docsData } = await supabase
        .from("request_documents" as any)
        .select("id, file_name, file_path, created_at, file_size, request_id")
        .eq("uploaded_by", user.id)
        .order("created_at", { ascending: false });
      setRealDocs((docsData as any[]) || []);
    } catch (err: any) {
      toast.error(err.message || "فشل الرفع");
    }
  };

  const stats = {
    total: requests.length,
    active: requests.filter(r => !["completed", "archived", "cancelled"].includes(r.status)).length,
    awaitingAction: requests.filter(r => ["stage_2_client_review", "stage_4_client_scope", "stage_7_client_draft"].includes(r.status)).length,
    completed: requests.filter(r => r.status === "completed").length,
  };

  // Mock ready reports
  const readyReports = requests
    .filter(r => r.status === "completed")
    .map((r, i) => ({
      id: r.id,
      title: r.property_description_ar || `تقرير تقييم #${i + 1}`,
      date: formatDate(r.updated_at || r.created_at),
      ref: r.reference_number || `RPT-${String(i + 1).padStart(4, "0")}`,
    }));

  const TABS = [
    { key: "requests" as const, label: "طلباتي", icon: FileText, count: stats.total },
    { key: "reports" as const, label: "التقارير الجاهزة", icon: CheckCircle, count: stats.completed },
    { key: "documents" as const, label: "المستندات", icon: FolderOpen, count: realDocs.length },
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
          <div className="flex items-center gap-2">
            <ClientNotificationsBell userId={userId} />
            <span className="text-sm text-foreground font-medium hidden sm:block">أهلاً، {userName}</span>
            <Button variant="ghost" size="icon" onClick={() => navigate("/client/settings")} title="الإعدادات">
              <Settings className="w-4 h-4" />
            </Button>
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
                      className="block p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {req.property_description_ar || "طلب تقييم"}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            {req.reference_number && (
                              <span className="font-mono" dir="ltr">{req.reference_number}</span>
                            )}
                            {req.property_city_ar && <span>{req.property_city_ar}</span>}
                            <span>{formatDate(req.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <EnhancedRequestTracker status={req.status} createdAt={req.created_at} compact />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "reports" && (
          <div className="space-y-4">
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
            {/* Archived Reports from admin */}
            <ClientArchivedReports userId={userId} />
          </div>
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
                <p className="text-xs text-muted-foreground">PDF • صور • Excel (XLSX, CSV) — حتى 20 ميجا</p>
                <p className="text-[11px] text-primary/70 mt-1">رفع Excel يسرّع إدخال الأصول تلقائياً</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </CardContent>
            </Card>

            {/* Docs list */}
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {realDocs.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">لا توجد مستندات مرفوعة بعد</div>
                ) : realDocs.map((doc) => {
                  const sizeLabel = doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(1)} MB` : "";
                  const handleDownload = async () => {
                    const { data } = supabase.storage.from("client-uploads").getPublicUrl(doc.file_path);
                    if (data?.publicUrl) window.open(data.publicUrl, "_blank");
                  };
                  return (
                    <div key={doc.id} className="flex items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.created_at?.slice(0, 10)}{sizeLabel ? ` · ${sizeLabel}` : ""}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}


        {/* ───── أقسام إضافية ───── */}
        <Separator className="my-2" />

        {/* منهجية طلب التقييم الذكية */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <ClipboardCheck className="w-4 h-4 text-primary" />
              </div>
              كيف تطلب تقييم بالطريقة الصحيحة؟
            </CardTitle>
            <p className="text-xs text-muted-foreground">اتبع هذه الخطوات لضمان تقييم دقيق وسريع</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-3">
              {[
                {
                  step: 1,
                  icon: <FileCheck className="w-5 h-5 text-primary" />,
                  title: "جهّز المستندات الأساسية",
                  desc: "صك الملكية أو عقد الإيجار، رخصة البناء، الكروكي، فواتير الشراء للمعدات والآلات. كلما كانت المستندات أكثر اكتمالاً، كان التقييم أدق وأسرع.",
                },
                {
                  step: 2,
                  icon: <Search className="w-5 h-5 text-primary" />,
                  title: "حدّد غرض التقييم بدقة",
                  desc: "هل التقييم لغرض البيع/الشراء، التمويل البنكي، التأمين، التصفية، الاندماج والاستحواذ، أو لأغراض محاسبية؟ تحديد الغرض يؤثر على أساس القيمة والمنهجية المستخدمة.",
                },
                {
                  step: 3,
                  icon: <BarChart3 className="w-5 h-5 text-primary" />,
                  title: "نحن نتولى الباقي",
                  desc: "يقوم فريقنا بتحديد منهجية التقييم الأنسب (سوقية، دخل، تكلفة) وفقاً لمعايير IVS الدولية ومعايير الهيئة السعودية للمقيمين المعتمدين (تقييم)، مع معاينة ميدانية شاملة.",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-3 items-start bg-muted/40 rounded-xl p-3.5 border border-border/50">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {item.step}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {item.icon}
                      <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">💡 نصيحة:</span>{" "}
                إرفاق جميع المستندات والصور من البداية يقلل مدة التقييم بنسبة تصل إلى 40% ويضمن دقة أعلى في النتائج.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* بيانات التواصل والدعم */}
        <Card className="bg-gradient-to-l from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Phone className="w-4 h-4 text-primary" />
              </div>
              تواصل معنا
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 bg-card rounded-lg p-3 border border-border">
                <Phone className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">الهاتف</p>
                  <p className="text-sm font-medium text-foreground" dir="ltr">0500668089</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-card rounded-lg p-3 border border-border">
                <Mail className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">البريد الإلكتروني</p>
                  <p className="text-sm font-medium text-foreground">care@jsaas-valuation.com</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-card rounded-lg p-3 border border-border">
                <Clock className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">ساعات العمل</p>
                  <p className="text-sm font-medium text-foreground">السبت - الخميس، 8ص - 5م</p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="https://wa.me/966500668089"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                تواصل عبر واتساب
              </a>
              <a
                href="/Profile_Jsaas_Valuation.pdf"
                download="بروفايل_جساس_للتقييم.pdf"
                className="inline-flex items-center gap-2 border border-border hover:bg-muted rounded-lg px-4 py-2.5 text-sm font-medium transition-colors text-foreground"
              >
                <Download className="w-4 h-4" />
                تحميل بروفايل الشركة
              </a>
              <a
                href="https://www.jsaas-valuation.com/ar"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-border hover:bg-muted rounded-lg px-4 py-2.5 text-sm font-medium transition-colors text-foreground"
              >
                الموقع الرسمي
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-3">
              الرياض - حي الياسمين - طريق الثمامة | سجل تجاري: 1010625839 | الرقم الضريبي: 310625839900003 | ترخيص آلات ومعدات: 4114000015 | ترخيص عقار: 1210001217
            </p>
          </CardContent>
        </Card>

      </main>

      <AppFooter />
    </div>
  );
}

// Archived reports component for client
function ClientArchivedReports({ userId }: { userId: string }) {
  const [archives, setArchives] = useState<any[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      // First try to find client record linked to this portal user
      const { data: clientRecord } = await supabase
        .from("clients")
        .select("id")
        .eq("portal_user_id", userId)
        .maybeSingle();

      let query = supabase
        .from("archived_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (clientRecord) {
        // Show all reports linked to the client record
        query = query.eq("client_id", clientRecord.id);
      } else {
        // Fallback: no linked client record, show nothing meaningful
        query = query.eq("uploaded_by", userId);
      }

      const { data } = await query;
      setArchives(data || []);
      setLoadingArchives(false);
    };
    load();
  }, [userId]);

  const handleDownload = async (report: any) => {
    const { data } = await supabase.storage
      .from("archived-reports")
      .createSignedUrl(report.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("فشل التحميل");
  };

  if (loadingArchives) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (archives.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary" />
          تقارير سابقة مؤرشفة
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {archives.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground truncate">{r.report_title_ar || r.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.report_number ? `${r.report_number} · ` : ""}{r.property_city_ar || ""} {r.report_date ? `· ${r.report_date}` : ""}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(r)}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
