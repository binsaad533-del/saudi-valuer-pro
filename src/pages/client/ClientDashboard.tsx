import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Plus, FileText, Clock, CheckCircle, AlertCircle, LogOut,
  Loader2, Building2, Upload, Download, Eye, FolderOpen, X, File,
  Phone, Mail, MessageCircle,
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

  // New request dialog
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [newReqNotes, setNewReqNotes] = useState("");
  const [newReqFiles, setNewReqFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const newReqFileRef = useRef<HTMLInputElement>(null);

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
      setLoading(false);
    };
    init();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.replace("/login");
  };

  const handleFileUpload = () => {
    toast.success("تم رفع المستند بنجاح (تجريبي)");
  };

  const handleNewReqFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setNewReqFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleSubmitNewRequest = async () => {
    if (newReqFiles.length === 0) {
      toast.error("يرجى رفع مستند واحد على الأقل");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل");

      // Upload files to client-uploads bucket
      const uploadedPaths: string[] = [];
      for (const file of newReqFiles) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("client-uploads").upload(path, file);
        if (error) throw error;
        uploadedPaths.push(path);
      }

      toast.success("تم إرسال طلب التقييم بنجاح");
      setShowNewRequest(false);
      setNewReqNotes("");
      setNewReqFiles([]);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء الإرسال");
    } finally {
      setSubmitting(false);
    }
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
      date: formatDate(r.updated_at || r.created_at),
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
          <div className="flex items-center gap-2">
            <ClientNotificationsBell userId={userId} />
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
          <Button onClick={() => setShowNewRequest(true)} className="gap-2">
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


        {/* ───── أقسام إضافية ───── */}
        <Separator className="my-2" />


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
                  <p className="text-xs text-muted-foreground">الهاتف الموحد</p>
                  <p className="text-sm font-medium text-foreground" dir="ltr">920015029</p>
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
                  <p className="text-sm font-medium text-foreground">الأحد - الخميس، 8ص - 5م</p>
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
                href="https://www.jsaas-valuation.com/ar"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-border hover:bg-muted rounded-lg px-4 py-2.5 text-sm font-medium transition-colors text-foreground"
              >
                الموقع الرسمي
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-3">
              الرياض - حي الياسمين - طريق الثمامة | سجل تجاري: 1010625839 | ترخيص تقييم: 4114000015
            </p>
          </CardContent>
        </Card>

      </main>

      {/* New Request Dialog */}
      <Dialog open={showNewRequest} onOpenChange={setShowNewRequest}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>طلب تقييم جديد</DialogTitle>
            <DialogDescription>ارفع المستندات المتعلقة بالأصل المراد تقييمه وسنتولى الباقي</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Upload area */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => newReqFileRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">اضغط لرفع المستندات</p>
              <p className="text-xs text-muted-foreground mt-1">صك، رخصة بناء، فواتير شراء، مواصفات فنية — PDF, JPG, PNG</p>
              <input
                ref={newReqFileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                className="hidden"
                onChange={handleNewReqFileAdd}
              />
            </div>

            {/* Selected files */}
            {newReqFiles.length > 0 && (
              <div className="space-y-2">
                {newReqFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 bg-muted/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <File className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                    <button
                      onClick={() => setNewReqFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="req-notes">ملاحظات (اختياري)</Label>
              <Textarea
                id="req-notes"
                placeholder="أي تفاصيل إضافية عن الأصل المراد تقييمه..."
                value={newReqNotes}
                onChange={(e) => setNewReqNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Button onClick={handleSubmitNewRequest} className="w-full gap-2" disabled={submitting || newReqFiles.length === 0}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              إرسال الطلب
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AppFooter />
    </div>
  );
}
