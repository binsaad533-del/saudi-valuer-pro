import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Home, FileText } from "lucide-react";

interface JourneyCompleteStepProps {
  requestId: string | null;
}

export default function JourneyCompleteStep({ requestId }: JourneyCompleteStepProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6">
        <CheckCircle className="w-10 h-10 text-success" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">تم إرسال طلبك بنجاح!</h2>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-2">
        سيتم مراجعة طلبك وإعداد التقرير وفقاً للمعايير المهنية المعتمدة.
        ستصلك إشعارات عند كل تحديث.
      </p>
      <div className="flex items-center gap-2 mt-2 mb-8">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">الوقت المتوقع: ٣-٥ أيام عمل</span>
      </div>
      <div className="w-full max-w-sm space-y-2">
        <Button onClick={() => navigate("/client")} className="w-full gap-2">
          <Home className="w-4 h-4" />
          العودة للوحة التحكم
        </Button>
        {requestId && (
          <Button onClick={() => navigate(`/client/request/${requestId}`)} variant="outline" className="w-full gap-2">
            <FileText className="w-4 h-4" />
            تتبع الطلب
          </Button>
        )}
      </div>
    </div>
  );
}
