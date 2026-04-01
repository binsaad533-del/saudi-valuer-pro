import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, Users, Clock, CheckCircle2, AlertTriangle, FileText } from "lucide-react";

interface Props {
  requests: any[];
  clients: any[];
}

export default function CoordinatorStatCards({ requests, clients }: Props) {
  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r =>
    ["draft", "client_submitted", "submitted", "under_pricing", "quotation_sent"].includes(r.status)
  ).length;
  const inProgress = requests.filter(r =>
    ["in_production", "inspection_assigned", "inspection_in_progress", "valuation_in_progress"].includes(r.status)
  ).length;
  const completed = requests.filter(r =>
    ["completed", "report_issued", "closed"].includes(r.status)
  ).length;
  const needsAttention = requests.filter(r =>
    ["payment_uploaded", "final_payment_uploaded", "client_comments", "awaiting_client_info"].includes(r.status)
  ).length;
  const totalClients = clients.length;

  const cards = [
    { label: "إجمالي الطلبات", value: totalRequests, icon: ClipboardList, color: "text-primary", bg: "bg-primary/10" },
    { label: "طلبات معلقة", value: pendingRequests, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "قيد التنفيذ", value: inProgress, icon: FileText, color: "text-accent-foreground", bg: "bg-accent" },
    { label: "مكتملة", value: completed, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: "تحتاج متابعة", value: needsAttention, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "العملاء", value: totalClients, icon: Users, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="shadow-card">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <span className="text-2xl font-bold text-foreground">{c.value}</span>
              <span className="text-[11px] text-muted-foreground leading-tight">{c.label}</span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
