import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  CreditCard, FileText, Upload, CheckCircle, Clock, Eye, MessageSquare,
} from "lucide-react";
import RaqeemAnimatedLogo from "./RaqeemAnimatedLogo";

interface ActionRequiredCardProps {
  request: any;
}

interface ActionInfo {
  title: string;
  description: string;
  buttonLabel: string;
  buttonAction: string;
  icon: React.ReactNode;
  variant?: "default" | "secondary";
}

function getActionInfo(request: any): ActionInfo {
  const status = request?.status;
  const id = request?.id;

  switch (status) {
    case "scope_generated":
      return {
        title: "نطاق العمل جاهز",
        description: "راجع نطاق العمل وعرض السعر ووافق عليه للمتابعة",
        buttonLabel: "مراجعة والموافقة",
        buttonAction: `/client/request/${id}`,
        icon: <FileText className="w-5 h-5 text-primary" />,
      };
    case "scope_approved":
      return {
        title: "بانتظار الدفع",
        description: "ادفع الدفعة الأولى لبدء تنفيذ التقييم",
        buttonLabel: "ادفع الآن",
        buttonAction: `/client/request/${id}`,
        icon: <CreditCard className="w-5 h-5 text-primary" />,
      };
    case "data_collection_open":
    case "needs_clarification":
      return {
        title: "مطلوب مستندات إضافية",
        description: "ارفع المستندات المطلوبة لاستكمال التقييم",
        buttonLabel: "ارفع المستندات",
        buttonAction: `/client/request/${id}`,
        icon: <Upload className="w-5 h-5 text-primary" />,
      };
    case "draft_report_ready":
    case "client_review":
      return {
        title: "مسودة التقرير جاهزة",
        description: "راجع مسودة التقرير واعتمدها أو أرسل ملاحظاتك",
        buttonLabel: "راجع التقرير",
        buttonAction: `/client/request/${id}`,
        icon: <Eye className="w-5 h-5 text-primary" />,
      };
    case "draft_approved":
      return {
        title: "بانتظار الدفعة النهائية",
        description: "ادفع الدفعة النهائية لإصدار التقرير الرسمي",
        buttonLabel: "ادفع الآن",
        buttonAction: `/client/request/${id}`,
        icon: <CreditCard className="w-5 h-5 text-primary" />,
      };
    case "issued":
      return {
        title: "التقرير جاهز",
        description: "التقرير النهائي جاهز للتحميل",
        buttonLabel: "تحميل التقرير",
        buttonAction: `/client/request/${id}`,
        icon: <CheckCircle className="w-5 h-5 text-emerald-600" />,
      };
    default:
      return {
        title: "طلبك قيد المعالجة",
        description: "فريقنا يعمل على طلبك حالياً. لا يوجد إجراء مطلوب منك الآن",
        buttonLabel: "تحدث مع رقيم",
        buttonAction: "/client/chat",
        icon: <Clock className="w-5 h-5 text-muted-foreground" />,
        variant: "secondary",
      };
  }
}

export default function ActionRequiredCard({ request }: ActionRequiredCardProps) {
  const navigate = useNavigate();

  if (!request) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 text-center space-y-3">
          <p className="text-sm text-foreground font-medium">ابدأ أول طلب تقييم</p>
          <p className="text-xs text-muted-foreground">ارفع مستنداتك وسنتولى الباقي</p>
          <Button onClick={() => navigate("/client/new-request")} className="w-full">
            طلب تقييم جديد
          </Button>
        </CardContent>
      </Card>
    );
  }

  const action = getActionInfo(request);

  return (
    <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            {action.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{action.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
          </div>
        </div>
        <div className="space-y-2">
          <Button
            onClick={() => navigate(action.buttonAction)}
            className="w-full"
            variant={action.variant || "default"}
          >
            {action.buttonLabel}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs gap-1.5 text-primary"
            onClick={() => navigate("/client/chat")}
          >
            <RaqeemAnimatedLogo size={16} />
            خل رقيم يساعدك
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
