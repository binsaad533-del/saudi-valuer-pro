import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, FileSearch, Building2, FileText, Truck } from "lucide-react";

const STAGES = [
  { key: "submitted", label: "تم الإرسال", icon: CheckCircle, statuses: ["submitted", "new"] },
  { key: "payment", label: "الدفع", icon: Clock, statuses: ["pending_payment", "payment_received"] },
  { key: "assigned", label: "تم التكليف", icon: Building2, statuses: ["assigned", "in_progress"] },
  { key: "inspection", label: "المعاينة", icon: FileSearch, statuses: ["inspection", "inspection_complete"] },
  { key: "report", label: "إعداد التقرير", icon: FileText, statuses: ["report_drafting", "review", "approved"] },
  { key: "delivered", label: "التسليم", icon: Truck, statuses: ["issued", "delivered", "completed"] },
];

interface Props {
  currentStatus: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function ClientRequestTracker({ currentStatus, createdAt, updatedAt }: Props) {
  // Determine which stage is active
  let activeIndex = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (STAGES[i].statuses.includes(currentStatus)) {
      activeIndex = i;
      break;
    }
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-foreground flex items-center gap-2">
          📦 تتبع حالة الطلب
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between relative">
          {/* Progress line */}
          <div className="absolute top-5 right-8 left-8 h-0.5 bg-border" />
          <div
            className="absolute top-5 right-8 h-0.5 bg-primary transition-all duration-500"
            style={{ width: `${(activeIndex / (STAGES.length - 1)) * 100}%` }}
          />

          {STAGES.map((stage, i) => {
            const isCompleted = i < activeIndex;
            const isActive = i === activeIndex;
            const Icon = stage.icon;

            return (
              <div key={stage.key} className="flex flex-col items-center z-10 relative" style={{ flex: 1 }}>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isActive
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                </div>
                <p className={`text-[10px] mt-2 text-center leading-tight ${
                  isActive ? "font-bold text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                }`}>
                  {stage.label}
                </p>
              </div>
            );
          })}
        </div>

        {createdAt && (
          <div className="mt-4 flex justify-between text-[10px] text-muted-foreground">
            <span>تاريخ الطلب: {new Date(createdAt).toLocaleDateString("ar-SA")}</span>
            {updatedAt && <span>آخر تحديث: {new Date(updatedAt).toLocaleDateString("ar-SA")}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
