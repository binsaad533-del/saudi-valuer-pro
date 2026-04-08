import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle, X, Loader2 } from "lucide-react";

interface DiscountCodeSectionProps {
  code: string;
  onCodeChange: (code: string) => void;
  applied: { code: string; percentage: number } | null;
  onApply: () => void;
  onClear: () => void;
  checking: boolean;
}

export function DiscountCodeSection({ code, onCodeChange, applied, onApply, onClear, checking }: DiscountCodeSectionProps) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">كود خصم (اختياري)</span>
        </div>
        {applied ? (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">{applied.code}</span>
              <Badge className="text-[9px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border-0">-{applied.percentage}%</Badge>
            </div>
            <button onClick={onClear} className="text-muted-foreground hover:text-destructive">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
              placeholder="أدخل كود الخصم"
              className="font-mono tracking-wider text-sm"
              dir="ltr"
            />
            <Button variant="outline" size="sm" onClick={onApply} disabled={checking || !code.trim()}>
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : "تطبيق"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
