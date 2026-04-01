import TopBar from "@/components/layout/TopBar";
import { formatNumber } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { formatNumber } from "@/lib/utils";
import { Search, Filter, Building2, MapPin, TrendingUp, Star, Plus } from "lucide-react";

const comparables = [
  { id: 1, type: "فيلا سكنية", city: "الرياض", district: "حي النرجس", area: 450, price: 2800000, pricePerM: 6222, date: "2026-02-15", confidence: 92, source: "صفقة فعلية" },
  { id: 2, type: "فيلا سكنية", city: "الرياض", district: "حي الياسمين", area: 380, price: 2200000, pricePerM: 5789, date: "2026-01-20", confidence: 88, source: "صفقة فعلية" },
  { id: 3, type: "فيلا سكنية", city: "الرياض", district: "حي العارض", area: 520, price: 3100000, pricePerM: 5961, date: "2025-12-10", confidence: 85, source: "عرض سوقي" },
  { id: 4, type: "أرض سكنية", city: "الرياض", district: "حي النرجس", area: 600, price: 1800000, pricePerM: 3000, date: "2026-03-01", confidence: 95, source: "صفقة فعلية" },
  { id: 5, type: "شقة", city: "جدة", district: "حي الروضة", area: 180, price: 950000, pricePerM: 5277, date: "2026-02-28", confidence: 78, source: "إعلان" },
];

export default function ComparablesPage() {
  const { role } = useAuth();
  const canAdd = ["owner"].includes(role || "");

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">قاعدة المقارنات السوقية</h2>
            <p className="text-sm text-muted-foreground">بيانات المقارنات والأدلة السوقية</p>
          </div>
          {canAdd && (
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg gradient-primary text-primary-foreground text-sm font-medium hover:opacity-90">
              <Plus className="w-4 h-4" />
              إضافة مقارن
            </button>
          )}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث في المقارنات..."
            className="w-full pr-10 pl-4 py-2.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="bg-card rounded-lg border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">النوع</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">الموقع</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">المساحة (م²)</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">السعر (ر.س)</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">سعر/م²</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">التاريخ</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">المصدر</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">الثقة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {comparables.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 text-sm">
                      <span className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {c.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        {c.city} - {c.district}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-inter" dir="ltr">{formatNumber(c.area)}</td>
                    <td className="px-5 py-3.5 text-sm font-medium font-inter" dir="ltr">{formatNumber(c.price)}</td>
                    <td className="px-5 py-3.5 text-sm font-inter" dir="ltr">{formatNumber(c.pricePerM)}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{c.date}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium
                        ${c.source === "صفقة فعلية" ? "bg-success/10 text-success" : c.source === "عرض سوقي" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                        {c.source}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${c.confidence >= 90 ? "bg-success" : c.confidence >= 80 ? "bg-primary" : "bg-warning"}`}
                            style={{ width: `${c.confidence}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-inter">{c.confidence}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
