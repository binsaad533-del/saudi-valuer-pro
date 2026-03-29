import { useState } from "react";
import { Search, SlidersHorizontal, FileText, Building2, MapPin } from "lucide-react";
import TopBar from "@/components/layout/TopBar";

const mockResults = [
  { id: "1", ref: "VAL-2026-0042", type: "فيلا سكنية", city: "الرياض", district: "حي النرجس", client: "شركة الراجحي للتطوير", status: "قيد التنفيذ", date: "2026-03-25" },
  { id: "2", ref: "VAL-2026-0041", type: "مبنى تجاري", city: "جدة", district: "حي الروضة", client: "مؤسسة البناء المتقدم", status: "مراجعة", date: "2026-03-22" },
  { id: "3", ref: "VAL-2026-0040", type: "أرض خام", city: "الدمام", district: "حي الشاطئ", client: "صندوق الاستثمارات العامة", status: "مكتمل", date: "2026-03-20" },
  { id: "4", ref: "VAL-2026-0039", type: "خط إنتاج", city: "الرياض", district: "حي العليا", client: "شركة دار الأركان", status: "جديد", date: "2026-03-18" },
  { id: "5", ref: "VAL-2026-0038", type: "عقار مدر للدخل", city: "مكة المكرمة", district: "حي العزيزية", client: "وزارة المالية", status: "مكتمل", date: "2026-03-15" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = mockResults.filter((r) =>
    !query || r.ref.includes(query) || r.client.includes(query) || r.city.includes(query) || r.type.includes(query)
  );

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 space-y-5">
        {/* Search Bar */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="ابحث برقم المرجع، اسم العميل، المدينة، أو نوع العقار..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pr-11 pl-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2
              ${showFilters ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:bg-muted"}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            فلاتر
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-lg border border-border bg-card animate-fade-in">
            <select className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm">
              <option value="">نوع العقار - الكل</option>
              <option>فيلا سكنية</option>
              <option>مبنى تجاري</option>
              <option>أرض خام</option>
              <option>آلات ومعدات</option>
            </select>
            <select className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm">
              <option value="">المدينة - الكل</option>
              <option>الرياض</option>
              <option>جدة</option>
              <option>الدمام</option>
              <option>مكة المكرمة</option>
            </select>
            <select className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm">
              <option value="">الحالة - الكل</option>
              <option>جديد</option>
              <option>قيد التنفيذ</option>
              <option>مراجعة</option>
              <option>مكتمل</option>
            </select>
          </div>
        )}

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          عرض <span className="font-semibold text-foreground">{filtered.length}</span> نتيجة
        </div>

        {/* Results */}
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {r.type.includes("خط") || r.type.includes("معدات") ? (
                  <Building2 className="w-5 h-5 text-primary" />
                ) : (
                  <FileText className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{r.ref}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{r.type}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{r.client}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.city} - {r.district}</span>
                </div>
              </div>
              <div className="text-left shrink-0">
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium
                  ${r.status === "مكتمل" ? "bg-accent/10 text-accent" :
                    r.status === "قيد التنفيذ" ? "bg-warning/10 text-warning" :
                    r.status === "مراجعة" ? "bg-primary/10 text-primary" :
                    "bg-muted text-muted-foreground"}`}>
                  {r.status}
                </span>
                <div className="text-[11px] text-muted-foreground mt-1">{r.date}</div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              لا توجد نتائج مطابقة
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
