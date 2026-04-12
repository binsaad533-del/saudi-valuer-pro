import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import TopBar from "@/components/layout/TopBar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search, Loader2, Users, FileText, Archive, ClipboardList,
  ArrowRight, User, Building2, Phone,
} from "lucide-react";

interface ClientResult {
  id: string;
  name_ar: string;
  phone: string | null;
  email: string | null;
  client_type: string;
  client_status: string;
}

interface AssignmentResult {
  id: string;
  reference_number: string;
  status: string;
  property_type: string | null;
  created_at: string;
  client_name?: string;
}

interface ArchivedResult {
  id: string;
  report_number: string | null;
  report_title_ar: string | null;
  report_date: string | null;
  client_name_ar: string | null;
}

type ResultCategory = "clients" | "requests" | "reports" | "archived";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  stage_1_processing: "قيد المعالجة",
  stage_2_client_review: "مراجعة العميل",
  stage_3_owner_scope: "تحديد النطاق",
  stage_4_client_scope: "اعتماد العميل",
  pending_payment_1: "بانتظار الدفع الأول",
  stage_5_inspection: "المعاينة الميدانية",
  stage_6_owner_draft: "مراجعة المالك",
  stage_7_client_draft: "مراجعة العميل للمسودة",
  pending_payment_2: "بانتظار الدفع الأخير",
  signing: "توقيع التقرير",
  issued: "صادر",
  archived: "مؤرشف",
  rejected: "مرفوض",
  cancelled: "ملغي",
  potential: "محتمل",
  verified: "مؤكد",
  portal: "لديه حساب",
};

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientResult[]>([]);
  const [activeRequests, setActiveRequests] = useState<AssignmentResult[]>([]);
  const [completedReports, setCompletedReports] = useState<AssignmentResult[]>([]);
  const [archivedReports, setArchivedReports] = useState<ArchivedResult[]>([]);
  const [searched, setSearched] = useState(false);

  const performSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setClients([]); setActiveRequests([]); setCompletedReports([]); setArchivedReports([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    const term = `%${q.trim()}%`;

    const [clientsRes, assignmentsRes, archivedRes] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name_ar, phone, email, client_type, client_status")
        .eq("is_active", true)
        .or(`name_ar.ilike.${term},phone.ilike.${term},email.ilike.${term},cr_number.ilike.${term},contact_person_ar.ilike.${term}`)
        .limit(15),
      supabase
        .from("valuation_assignments")
        .select("id, reference_number, status, property_type, created_at, clients!inner(name_ar)")
        .or(`reference_number.ilike.${term},clients.name_ar.ilike.${term}`)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("archived_reports")
        .select("id, report_number, report_title_ar, report_date, client_name_ar")
        .or(`report_number.ilike.${term},client_name_ar.ilike.${term},report_title_ar.ilike.${term}`)
        .order("report_date", { ascending: false })
        .limit(15),
    ]);

    setClients(clientsRes.data || []);

    const allAssignments = (assignmentsRes.data || []).map((a: any) => ({
      ...a,
      client_name: a.clients?.name_ar || "",
    }));
    setActiveRequests(allAssignments.filter((a: AssignmentResult) => !["approved", "issued"].includes(a.status)));
    setCompletedReports(allAssignments.filter((a: AssignmentResult) => ["approved", "issued"].includes(a.status)));
    setArchivedReports(archivedRes.data || []);
    setLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 350);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const totalResults = clients.length + activeRequests.length + completedReports.length + archivedReports.length;

  const sections: {
    key: ResultCategory;
    label: string;
    icon: React.ElementType;
    count: number;
    color: string;
  }[] = [
    { key: "clients", label: "العملاء", icon: Users, count: clients.length, color: "text-primary" },
    { key: "requests", label: "الطلبات النشطة", icon: ClipboardList, count: activeRequests.length, color: "text-warning" },
    { key: "reports", label: "التقارير المكتملة", icon: FileText, count: completedReports.length, color: "text-success" },
    { key: "archived", label: "التقارير الأرشيفية", icon: Archive, count: archivedReports.length, color: "text-muted-foreground" },
  ];

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="ابحث باسم عميل / رقم جوال / رقم تقرير / رقم طلب"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pr-12 py-6 text-base rounded-xl border-border"
            autoFocus
          />
          {loading && <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-primary" />}
        </div>

        {/* Results summary */}
        {searched && !loading && (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{totalResults}</span> نتيجة
            </span>
            {sections.filter(s => s.count > 0).map(s => (
              <span key={s.key} className="flex items-center gap-1 text-xs text-muted-foreground">
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                {s.label}: {s.count}
              </span>
            ))}
          </div>
        )}

        {/* Empty state */}
        {searched && !loading && totalResults === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">لا توجد نتائج مطابقة</p>
            <p className="text-xs mt-1">حاول البحث باسم مختلف أو رقم آخر</p>
          </div>
        )}

        {/* Clients */}
        {clients.length > 0 && (
          <Section title="العملاء" icon={Users} count={clients.length} color="text-primary">
            {clients.map(c => (
              <ResultRow
                key={c.id}
                icon={c.client_type === "company" ? Building2 : User}
                title={c.name_ar}
                subtitle={c.phone ? <span dir="ltr" className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span> : c.email || "—"}
                badge={STATUS_LABELS[c.client_status] || c.client_status}
                badgeVariant={c.client_status === "portal" ? "default" : "outline"}
                onClick={() => navigate(`/clients/${c.id}`)}
              />
            ))}
          </Section>
        )}

        {/* Active Requests */}
        {activeRequests.length > 0 && (
          <Section title="الطلبات النشطة" icon={ClipboardList} count={activeRequests.length} color="text-warning">
            {activeRequests.map(a => (
              <ResultRow
                key={a.id}
                icon={ClipboardList}
                title={a.reference_number || a.id.slice(0, 8)}
                subtitle={a.client_name || a.property_type || "—"}
                badge={STATUS_LABELS[a.status] || a.status}
                badgeVariant={a.status === "under_review" ? "default" : "secondary"}
                onClick={() => navigate(`/valuations/${a.id}`)}
              />
            ))}
          </Section>
        )}

        {/* Completed Reports */}
        {completedReports.length > 0 && (
          <Section title="التقارير المكتملة" icon={FileText} count={completedReports.length} color="text-success">
            {completedReports.map(r => (
              <ResultRow
                key={r.id}
                icon={FileText}
                title={r.reference_number || r.id.slice(0, 8)}
                subtitle={r.client_name || "—"}
                badge={STATUS_LABELS[r.status] || r.status}
                badgeVariant="default"
                onClick={() => navigate(`/valuations/${r.id}`)}
              />
            ))}
          </Section>
        )}

        {/* Archived Reports */}
        {archivedReports.length > 0 && (
          <Section title="التقارير الأرشيفية" icon={Archive} count={archivedReports.length} color="text-muted-foreground">
            {archivedReports.map(r => (
              <ResultRow
                key={r.id}
                icon={Archive}
                title={r.report_number || "—"}
                subtitle={r.client_name_ar || r.report_title_ar || "—"}
                badge={r.report_date ? new Date(r.report_date).toLocaleDateString("ar-SA") : "—"}
                badgeVariant="outline"
                onClick={() => navigate("/archive")}
              />
            ))}
          </Section>
        )}

        {/* Idle state */}
        {!searched && (
          <div className="text-center py-20 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-sm">ابدأ بكتابة اسم العميل أو رقم الجوال أو رقم التقرير</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, count, color, children }: {
  title: string;
  icon: React.ElementType;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ResultRow({ icon: Icon, title, subtitle, badge, badgeVariant, onClick }: {
  icon: React.ElementType;
  title: string;
  subtitle: React.ReactNode;
  badge: string;
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors text-right"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <Badge variant={badgeVariant} className="text-[10px] shrink-0">{badge}</Badge>
      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}
