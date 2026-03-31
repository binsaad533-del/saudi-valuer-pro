import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type GenerationStep = "received" | "processing" | "review" | "ready";

interface StepDef {
  key: GenerationStep;
  label: string;
}

const STEPS: StepDef[] = [
  { key: "received", label: "استلام" },
  { key: "processing", label: "معالجة" },
  { key: "review", label: "مراجعة" },
  { key: "ready", label: "جاهز" },
];

interface Props {
  currentStep: GenerationStep;
  isStatic?: boolean;
}

export default function ReportGenerationStepper({ currentStep, isStatic = false }: Props) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-between w-full max-w-lg mx-auto py-4">
      {STEPS.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all",
                  isDone && "bg-primary border-primary text-primary-foreground",
                  isCurrent && !isStatic && "border-primary text-primary bg-primary/10 animate-pulse",
                  isCurrent && isStatic && "bg-primary border-primary text-primary-foreground",
                  !isDone && !isCurrent && "border-muted-foreground/30 text-muted-foreground/50 bg-muted/30"
                )}
              >
                {isDone || (isCurrent && isStatic) ? (
                  <Check className="w-4 h-4" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  (isDone || (isCurrent && isStatic)) && "text-primary",
                  isCurrent && !isStatic && "text-primary font-bold",
                  !isDone && !isCurrent && "text-muted-foreground/50"
                )}
              >
                {step.label}
              </span>
            </div>

            {idx < STEPS.length - 1 && (
              <div className="flex-1 mx-2">
                <div
                  className={cn(
                    "h-0.5 rounded-full transition-all",
                    idx < currentIdx ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
