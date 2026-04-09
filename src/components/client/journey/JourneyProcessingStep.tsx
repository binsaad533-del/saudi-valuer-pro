import { Progress } from "@/components/ui/progress";
import { Shield } from "lucide-react";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";

interface JourneyProcessingStepProps {
  processingStatus: string;
  processingProgress: number;
}

export default function JourneyProcessingStep({ processingStatus, processingProgress }: JourneyProcessingStepProps) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">جارٍ تجهيز طلبك</h3>
      <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">{processingStatus}</p>
      <div className="w-full max-w-xs">
        <Progress value={processingProgress} className="h-2 mb-2" />
        <p className="text-xs text-muted-foreground text-center">{processingProgress}%</p>
      </div>
      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="w-3.5 h-3.5" />
        <span>يتم التحليل وفقاً للمعايير المهنية المعتمدة</span>
      </div>
    </div>
  );
}
