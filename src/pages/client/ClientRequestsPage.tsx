import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Building2 } from "lucide-react";
import { RequestTracker } from "@/components/client/RequestTracker";
import { formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة", submitted: "تم الإرسال", scope_generated: "نطاق العمل جاهز",
  scope_approved: "بانتظار الدفع", first_payment_confirmed: "تم الدفع",
  data_collection_open: "مطلوب مستندات", inspection_pending: "بانتظار المعاينة",
  inspection_completed: "تمت المعاينة", draft_report_ready: "مسودة جاهزة",
  client_review: "بانتظار مراجعتك", draft_approved: "بانتظار الدفعة النهائية",
  issued: "التقرير جاهز", completed: "مكتمل", cancelled: "ملغي", archived: "مؤرشف",
};

export default function ClientRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
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
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.property_description_ar || "").toLowerCase().includes(q)
      || (r.reference_number || "").toLowerCase().includes(q)
      || (r.property_city_ar || "").toLowerCase().includes(q);
  });

  return (
    <div className="bg-background" dir="rtl">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <h2 className="text-sm font-bold text-foreground">طلباتي</h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>

        <p className="text-[10px] text-muted-foreground">{filtered.length} طلب</p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {requests.length === 0 ? "لا توجد طلبات بعد" : "لا توجد نتائج"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((req) => (
              <Link key={req.id} to={`/client/request/${req.id}`}>
                <Card className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground truncate flex-1">
                        {req.property_description_ar || "طلب تقييم"}
                      </p>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {STATUS_LABELS[req.status] || req.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      {req.reference_number && <span className="font-mono" dir="ltr">{req.reference_number}</span>}
                      <span>{formatDate(req.created_at)}</span>
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
