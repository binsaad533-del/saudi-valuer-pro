import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, FileText, Search, Loader2, Building2, Plus, Filter,
} from "lucide-react";
import { RequestTracker } from "@/components/client/RequestTracker";
import { formatDate } from "@/lib/utils";


const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  submitted: "تم الإرسال",
  received: "تم الاستلام",
  pending_payment: "بانتظار الدفع",
  quotation_sent: "تم إرسال العرض",
  payment_received: "تم الدفع",
  under_review: "قيد المراجعة",
  needs_clarification: "يحتاج توضيح",
  in_progress: "جاري التقييم",
  inspection_scheduled: "موعد المعاينة",
  inspection_completed: "تمت المعاينة",
  report_drafting: "إعداد التقرير",
  draft_report_sent: "مسودة التقرير",
  quality_review: "مراجعة الجودة",
  final_review: "المراجعة النهائية",
  approved: "معتمد",
  completed: "مكتمل",
  cancelled: "ملغي",
  archived: "مؤرشف",
};

const FILTER_OPTIONS = [
  { key: "all", label: "الكل" },
  { key: "active", label: "نشطة" },
  { key: "completed", label: "مكتملة" },
  { key: "cancelled", label: "ملغاة" },
];

export default function ClientRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/client/login"); return; }

      const { data } = await supabase
        .from("valuation_requests" as any)
        .select("*")
        .eq("client_user_id", user.id)
        .order("created_at", { ascending: false });

      setRequests(data || []);
      setLoading(false);
    };
    load();
  }, [navigate]);

  const filtered = requests.filter((r) => {
    if (filter === "active" && ["completed", "archived", "cancelled"].includes(r.status)) return false;
    if (filter === "completed" && r.status !== "completed") return false;
    if (filter === "cancelled" && r.status !== "cancelled") return false;

    if (search) {
      const q = search.toLowerCase();
      const desc = (r.property_description_ar || "").toLowerCase();
      const ref = (r.reference_number || "").toLowerCase();
      const city = (r.property_city_ar || "").toLowerCase();
      if (!desc.includes(q) && !ref.includes(q) && !city.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/client/dashboard")}>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <h2 className="text-sm font-bold text-foreground">طلباتي</h2>
          </div>
          <Button size="sm" onClick={() => navigate("/client/dashboard")} className="gap-1.5">
            <Plus className="w-4 h-4" /> طلب جديد
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالوصف أو الرقم المرجعي أو المدينة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-muted p-1 shrink-0">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === opt.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <p className="text-xs text-muted-foreground">{filtered.length} طلب</p>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16">
              <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {requests.length === 0 ? "لا توجد طلبات بعد" : "لا توجد نتائج مطابقة"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => (
              <Link key={req.id} to={`/client/request/${req.id}`}>
                <Card className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
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
                      <Badge variant="outline" className="text-xs shrink-0">
                        {STATUS_LABELS[req.status] || req.status}
                      </Badge>
                    </div>
                    <RequestTracker status={req.status} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
