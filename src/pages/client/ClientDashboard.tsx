import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Building2, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { EnhancedRequestTracker } from "@/components/client/EnhancedRequestTracker";
import ActionRequiredCard from "@/components/client/ActionRequiredCard";

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

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

  // Find the most actionable request
  const actionableStatuses = [
    "scope_generated", "scope_approved", "data_collection_open", "needs_clarification",
    "draft_report_ready", "client_review", "draft_approved", "issued",
  ];
  const actionableRequest = requests.find(r => actionableStatuses.includes(r.status))
    || requests[0] || null;

  const recentRequests = requests.slice(0, 5);

  return (
    <div className="bg-background" dir="rtl">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-lg font-bold text-foreground">مرحباً، {userName}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">هذا وضع طلبك</p>
        </div>

        {/* Action Required */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <ActionRequiredCard request={actionableRequest} />

            {/* Recent Requests */}
            {recentRequests.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-foreground">طلباتي</h2>
                  {requests.length > 5 && (
                    <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/client/requests")}>
                      عرض الكل <ArrowLeft className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <Card>
                  <CardContent className="p-0 divide-y divide-border">
                    {recentRequests.map((req) => (
                      <Link key={req.id} to={`/client/request/${req.id}`} className="block p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="text-sm font-medium text-foreground truncate flex-1">
                            {req.property_description_ar || "طلب تقييم"}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDate(req.created_at)}
                          </span>
                        </div>
                        <EnhancedRequestTracker
                          status={req.status}
                          createdAt={req.created_at}
                          compact
                          valuationMode={req.ai_intake_summary?.valuation_mode || req.inspection_type || "field"}
                        />
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Empty State */}
            {requests.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد طلبات بعد</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
