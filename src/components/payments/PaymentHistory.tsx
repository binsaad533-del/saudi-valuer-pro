import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/utils";


interface PaymentHistoryProps {
  requestId: string;
  refreshKey?: number;
}

export default function PaymentHistory({ requestId, refreshKey }: PaymentHistoryProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("payments" as any)
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false });
      setPayments(data || []);
      setLoading(false);
    };
    load();
  }, [requestId, refreshKey]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid": return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case "failed": return <XCircle className="w-3.5 h-3.5 text-destructive" />;
      case "pending": return <Clock className="w-3.5 h-3.5 text-amber-500" />;
      case "cancelled": return <XCircle className="w-3.5 h-3.5 text-muted-foreground" />;
      case "refunded": return <RefreshCw className="w-3.5 h-3.5 text-blue-500" />;
      default: return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      paid: "مدفوع", failed: "فشل", pending: "معلق", cancelled: "ملغي",
      refunded: "مسترد", manual_review: "مراجعة يدوية",
    };
    return map[status] || status;
  };

  const getStageLabel = (stage: string) => {
    const map: Record<string, string> = { first: "دفعة أولى", final: "دفعة نهائية", full: "دفعة كاملة" };
    return map[stage] || stage;
  };

  const getMethodLabel = (method: string) => {
    const map: Record<string, string> = { mada: "مدى", visa: "فيزا", mastercard: "ماستركارد", applepay: "آبل باي", manual: "يدوي" };
    return map[method] || method;
  };

  if (loading || payments.length === 0) return null;

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          سجل المدفوعات ({payments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {payments.map((pay) => (
            <div key={pay.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2">
                {getStatusIcon(pay.payment_status)}
                <div>
                  <p className="text-xs font-medium text-foreground">{getStageLabel(pay.payment_stage)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {getMethodLabel(pay.payment_method)} • {formatDate(pay.created_at)}
                  </p>
                </div>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-foreground" dir="ltr">{formatNumber(Number(pay.amount))} ر.س</p>
                <Badge variant="secondary" className={`text-[10px] ${
                  pay.payment_status === "paid" ? "bg-green-500/10 text-green-600" :
                  pay.payment_status === "failed" ? "bg-destructive/10 text-destructive" :
                  "bg-amber-500/10 text-amber-600"
                }`}>
                  {getStatusLabel(pay.payment_status)}
                  {pay.is_mock && " (تجريبي)"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
