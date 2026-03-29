import { Brain } from "lucide-react";
import { Link } from "react-router-dom";

export default function ValuationProductionList() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">محرك التقييم</h1>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">اختر تقييماً من قائمة التقييمات للدخول إلى محرك التقييم</p>
        <Link to="/valuations" className="mt-4 inline-block text-primary hover:underline text-sm">
          عرض التقييمات
        </Link>
      </div>
    </div>
  );
}
