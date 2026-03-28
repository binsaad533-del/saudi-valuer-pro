import { Link } from "react-router-dom";
import { ChevronLeft, Clock, MapPin, Building2 } from "lucide-react";

interface Assignment {
  id: string;
  refNumber: string;
  propertyType: string;
  city: string;
  status: string;
  statusColor: string;
  client: string;
  date: string;
}

const mockAssignments: Assignment[] = [
  {
    id: "1",
    refNumber: "VAL-2026-0042",
    propertyType: "فيلا سكنية",
    city: "الرياض",
    status: "قيد التقييم",
    statusColor: "bg-primary/10 text-primary",
    client: "شركة الراجحي للتطوير",
    date: "2026-03-25",
  },
  {
    id: "2",
    refNumber: "VAL-2026-0041",
    propertyType: "مبنى تجاري",
    city: "جدة",
    status: "قيد المراجعة",
    statusColor: "bg-warning/10 text-warning",
    client: "مؤسسة البناء المتقدم",
    date: "2026-03-22",
  },
  {
    id: "3",
    refNumber: "VAL-2026-0040",
    propertyType: "أرض خام",
    city: "الدمام",
    status: "مكتمل",
    statusColor: "bg-success/10 text-success",
    client: "صندوق الاستثمارات العامة",
    date: "2026-03-20",
  },
  {
    id: "4",
    refNumber: "VAL-2026-0039",
    propertyType: "مجمع سكني",
    city: "الرياض",
    status: "بانتظار المستندات",
    statusColor: "bg-muted text-muted-foreground",
    client: "شركة دار الأركان",
    date: "2026-03-18",
  },
  {
    id: "5",
    refNumber: "VAL-2026-0038",
    propertyType: "عقار مدر للدخل",
    city: "مكة المكرمة",
    status: "معتمد",
    statusColor: "bg-success/10 text-success",
    client: "وزارة المالية",
    date: "2026-03-15",
  },
];

export default function RecentAssignments() {
  return (
    <div className="bg-card rounded-lg border border-border shadow-card animate-fade-in">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">آخر التقييمات</h3>
        <Link
          to="/valuations"
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          عرض الكل
          <ChevronLeft className="w-4 h-4" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {mockAssignments.map((a) => (
          <Link
            key={a.id}
            to={`/valuations/${a.id}`}
            className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <Building2 className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">{a.refNumber}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${a.statusColor}`}>
                    {a.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{a.propertyType}</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {a.city}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {a.date}
                  </span>
                </div>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{a.client}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
