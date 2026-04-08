import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";

interface StepMeta {
  key: string;
  label: string;
}

interface JourneyHeaderProps {
  step: string;
  stepMeta: StepMeta[];
  currentIdx: number;
  onBack: () => void;
}

export default function JourneyHeader({ step, stepMeta, currentIdx, onBack }: JourneyHeaderProps) {
  return (
    <>
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="جساس" className="w-8 h-8" />
            <h2 className="text-sm font-bold text-foreground">طلب تقييم</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowRight className="w-4 h-4 ml-1" />
            العودة
          </Button>
        </div>
      </header>

      {step !== "complete" && (
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-2">
          <div className="flex items-center justify-between mb-3">
            {stepMeta.map((s, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <div key={s.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      done ? "bg-success text-success-foreground" :
                      active ? "bg-primary text-primary-foreground shadow-md" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-medium ${active ? "text-primary" : done ? "text-success" : "text-muted-foreground"}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < stepMeta.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mt-[-14px] rounded ${done ? "bg-success" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
