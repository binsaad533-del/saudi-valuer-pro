import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";

interface Props {
  requests: any[];
}

export default function CoordinatorAlerts({ requests }: Props) {
  const pendingPayments = requests.filter(r =>
    ["payment_uploaded", "final_payment_uploaded"].includes(r.status)
  ).length;
  const awaitingClientInfo = requests.filter(r => r.status === "awaiting_client_info").length;
  const staleRequests = requests.filter(r => {
    if (["completed", "closed", "report_issued"].includes(r.status)) return false;
    const daysSince = (Date.now() - new Date(r.updated_at || r.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 5;
  }).length;

  const alerts = [
    pendingPayments > 0 && {
      icon: CreditCard,
      title: `${pendingPayments} إيصال دفع بانتظار المراجعة`,
      variant: "destructive" as const,
    },
    awaitingClientInfo > 0 && {
      icon: Clock,
      title: `${awaitingClientInfo} طلب بانتظار معلومات من العميل`,
      variant: "default" as const,
    },
    staleRequests > 0 && {
      icon: AlertTriangle,
      title: `${staleRequests} طلب لم يتم تحديثه منذ أكثر من 5 أيام`,
      variant: "default" as const,
    },
  ].filter(Boolean) as { icon: any; title: string; variant: "default" | "destructive" }[];

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => {
        const Icon = a.icon;
        return (
          <Alert key={i} variant={a.variant} className="py-2.5">
            <Icon className="h-4 w-4" />
            <AlertTitle className="text-sm">{a.title}</AlertTitle>
          </Alert>
        );
      })}
    </div>
  );
}
