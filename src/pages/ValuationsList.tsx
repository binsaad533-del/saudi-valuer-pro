import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import {
  Search,
  Building2,
  MapPin,
  Clock,
  ChevronLeft,
  Plus,
  FileText,
  FolderPlus,
  ClipboardCheck,
  CheckCircle,
} from "lucide-react";

type Tab = "all" | "review" | "completed";

type Discipline = "all" | "real_estate" | "machinery" | "mixed";

const disciplineLabels: Record<Discipline, string> = {
  all: "الكل",
  real_estate: "عقار",
  machinery: "آلات ومعدات",
  mixed: "مختلط",
};

type Status = "all" | "new" | "in_progress" | "review" | "completed" | "archived";

const statusLabels: Record<Status, string> = {
  all: "الكل",
  new: "جديد",
  in_progress: "قيد التنفيذ",
  review: "قيد المراجعة",
  completed: "مكتمل",
  archived: "مؤرشف",
};

const statusStyles: Record<string, string> = {
  new: "bg-primary/10 text-primary",
  in_progress: "bg-warning/10 text-warning",
  review: "bg-accent/10 text-accent",
  completed: "bg-success/10 text-success",
  archived: "bg-muted text-muted-foreground",
};

const mockValuations = [
  { id: "1", ref: "VAL-2026-0042", type: "فيلا سكنية", discipline: "real_estate" as Discipline, city: "الرياض", district: "حي النرجس", status: "in_progress", client: "شركة الراجحي للتطوير", date: "2026-03-25", purpose: "بيع", value: "2,500,000" },
  { id: "2", ref: "VAL-2026-0041", type: "مبنى تجاري", discipline: "mixed" as Discipline, city: "جدة", district: "حي الروضة", status: "review", client: "مؤسسة البناء المتقدم", date: "2026-03-22", purpose: "تمويل", value: "8,750,000" },
  { id: "3", ref: "VAL-2026-0040", type: "أرض خام", discipline: "real_estate" as Discipline, city: "الدمام", district: "حي الشاطئ", status: "completed", client: "صندوق الاستثمارات العامة", date: "2026-03-20", purpose: "استثمار", value: "15,200,000" },
  { id: "4", ref: "VAL-2026-0039", type: "خط إنتاج", discipline: "machinery" as Discipline, city: "الرياض", district: "حي العليا", status: "new", client: "شركة دار الأركان", date: "2026-03-18", purpose: "بيع", value: "-" },
  { id: "5", ref: "VAL-2026-0038", type: "عقار مدر للدخل", discipline: "real_estate" as Discipline, city: "مكة المكرمة", district: "حي العزيزية", status: "completed", client: "وزارة المالية", date: "2026-03-15", purpose: "نزع ملكية", value: "22,000,000" },
  { id: "6", ref: "VAL-2026-0037", type: "معدات ثقيلة", discipline: "machinery" as Discipline, city: "الرياض", district: "حي الملقا", status: "archived", client: "شركة سمو العقارية", date: "2026-03-10", purpose: "تمويل", value: "45,000,000" },
];

export default function ValuationsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as Tab) || "all";
  const [activeStatus, setActiveStatus] = useState<Status>("all");
  const [activeDiscipline, setActiveDiscipline] = useState<Discipline>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const setActiveTab = (tab: Tab) => {
    setSearchParams(tab === "all" ? {} : { tab });
    if (tab === "review") setActiveStatus("review");
    else if (tab === "completed") setActiveStatus("completed");
    else setActiveStatus("all");
  };

  const filtered = mockValuations.filter((v) => {
    if (activeStatus !== "all" && v.status !== activeStatus) return false;
    if (searchQuery && !v.ref.includes(searchQuery) && !v.client.includes(searchQuery) && !v.city.includes(searchQuery))
      return false;
    return true;
  });

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">إدارة التقييمات</h2>
            <p className="text-sm text-muted-foreground">جميع ملفات التقييم العقاري</p>
          </div>
          <Link
            to="/valuations/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg gradient-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            طلب تقييم جديد
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="بحث بالرقم المرجعي، العميل، المدينة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(statusLabels) as Status[]).map((s) => (
              <button
                key={s}
                onClick={() => setActiveStatus(s)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors
                  ${activeStatus === s ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                {statusLabels[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-lg border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">الرقم المرجعي</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">نوع العقار</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">الموقع</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">العميل</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">الغرض</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">الحالة</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">القيمة (ر.س)</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">التاريخ</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-primary">{v.ref}</td>
                    <td className="px-5 py-3.5 text-sm">
                      <span className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {v.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        {v.city} - {v.district}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{v.client}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{v.purpose}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${statusStyles[v.status]}`}>
                        {statusLabels[v.status as Status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-foreground font-inter" dir="ltr">
                      {v.value}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {v.date}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link to={`/valuations/${v.id}`} className="text-primary hover:text-primary/80">
                        <ChevronLeft className="w-4 h-4" />
                      </Link>
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
